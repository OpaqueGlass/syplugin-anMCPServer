import { logPush, errorPush } from "@/logger";
import { getPluginInstance } from "./pluginHelper";
import * as jose from "jose";

// ============================================================================
// Types
// ============================================================================

export interface CloudflareAccessConfig {
    enabled: boolean;
    teamDomain: string;  // e.g., "https://myteam.cloudflareaccess.com"
    policyAud: string;   // Application Audience (AUD) tag
}

export interface CloudflareAccessPayload {
    email?: string;
    sub?: string;
    iss?: string;
    aud?: string[];
    iat?: number;
    exp?: number;
    country?: string;
    [key: string]: unknown;
}

interface CachedToken {
    payload: CloudflareAccessPayload;
    expiresAt: number;
}

// ============================================================================
// Caches
// ============================================================================

// Cache for JWKS KeyLike function - reused across validations
let jwksCache: jose.JWTVerifyGetKey | null = null;
let jwksCachedDomain: string = "";

// Cache for validated tokens - avoid re-validating the same token
const tokenCache = new Map<string, CachedToken>();
const TOKEN_CACHE_BUFFER = 30 * 1000; // Expire tokens 30s before actual expiry
const MAX_TOKEN_CACHE_SIZE = 100;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get Cloudflare Access configuration from plugin settings
 */
export function getCloudflareAccessConfig(): CloudflareAccessConfig {
    const plugin = getPluginInstance();
    return {
        enabled: plugin?.mySettings?.["cfAccessEnabled"] === true,
        teamDomain: plugin?.mySettings?.["cfAccessTeamDomain"] || "",
        policyAud: plugin?.mySettings?.["cfAccessPolicyAud"] || "",
    };
}

/**
 * Check if Cloudflare Access authentication is properly configured
 */
export function isCloudflareAccessConfigured(): boolean {
    const config = getCloudflareAccessConfig();
    return config.enabled &&
           config.teamDomain.length > 0 &&
           config.policyAud.length > 0;
}

// ============================================================================
// JWKS Management
// ============================================================================

/**
 * Get or create JWKS instance for the given team domain
 * Reuses cached instance if domain matches
 */
function getJWKS(teamDomain: string): jose.JWTVerifyGetKey {
    if (jwksCache && jwksCachedDomain === teamDomain) {
        return jwksCache;
    }

    // Support both OIDC SaaS apps and standard Access apps
    // OIDC: https://team.cloudflareaccess.com/cdn-cgi/access/sso/oidc/{client_id}
    // Standard: https://team.cloudflareaccess.com
    const certsUrl = teamDomain.includes('/cdn-cgi/access/sso/oidc/')
        ? `${teamDomain}/jwks`
        : `${teamDomain}/cdn-cgi/access/certs`;
    logPush("Creating JWKS instance for:", certsUrl);

    jwksCache = jose.createRemoteJWKSet(new URL(certsUrl));
    jwksCachedDomain = teamDomain;

    return jwksCache;
}

/**
 * Clear all caches (useful when configuration changes)
 */
export function clearJWKSCache(): void {
    jwksCache = null;
    jwksCachedDomain = "";
    tokenCache.clear();
    logPush("Cloudflare Access caches cleared");
}

// ============================================================================
// Token Caching
// ============================================================================

/**
 * Generate a simple hash for token cache key
 * Uses first and last 16 chars + length to create a unique-enough key
 */
function getTokenCacheKey(token: string): string {
    if (token.length < 40) return token;
    return `${token.slice(0, 16)}...${token.slice(-16)}:${token.length}`;
}

/**
 * Get cached token payload if still valid
 */
function getCachedToken(token: string): CloudflareAccessPayload | null {
    const key = getTokenCacheKey(token);
    const cached = tokenCache.get(key);

    if (!cached) return null;

    // Check if token is still valid (with buffer)
    if (Date.now() >= cached.expiresAt) {
        tokenCache.delete(key);
        return null;
    }

    return cached.payload;
}

/**
 * Cache a validated token
 */
function cacheToken(token: string, payload: CloudflareAccessPayload): void {
    // Evict oldest entries if cache is full
    if (tokenCache.size >= MAX_TOKEN_CACHE_SIZE) {
        const firstKey = tokenCache.keys().next().value;
        if (firstKey) tokenCache.delete(firstKey);
    }

    const key = getTokenCacheKey(token);
    const exp = payload.exp || 0;
    const expiresAt = exp * 1000 - TOKEN_CACHE_BUFFER;

    tokenCache.set(key, { payload, expiresAt });
}

// ============================================================================
// Token Validation
// ============================================================================

/**
 * Validate a Cloudflare Access JWT token
 * Uses cached results when possible for performance
 *
 * @param token The JWT token from Cf-Access-Jwt-Assertion header or Bearer
 * @returns The decoded payload if valid, null if invalid
 */
export async function validateCloudflareAccessToken(token: string): Promise<CloudflareAccessPayload | null> {
    const config = getCloudflareAccessConfig();

    if (!config.enabled) {
        logPush("Cloudflare Access is not enabled");
        return null;
    }

    if (!config.teamDomain || !config.policyAud) {
        errorPush("Cloudflare Access is enabled but not properly configured");
        return null;
    }

    // Check cache first
    const cached = getCachedToken(token);
    if (cached) {
        logPush("Using cached Cloudflare Access token for:", cached.email || cached.sub);
        return cached;
    }

    try {
        // Normalize team domain (remove trailing slash)
        const teamDomain = config.teamDomain.replace(/\/$/, "");

        // Get or create JWKS instance (cached)
        const JWKS = getJWKS(teamDomain);

        // Verify the token
        const { payload } = await jose.jwtVerify(token, JWKS, {
            issuer: teamDomain,
            audience: config.policyAud,
        });

        const cfPayload = payload as CloudflareAccessPayload;

        // Cache the validated token
        cacheToken(token, cfPayload);

        logPush("Cloudflare Access token validated for:", cfPayload.email || cfPayload.sub);
        return cfPayload;
    } catch (err) {
        errorPush("Cloudflare Access token validation failed:", err);
        return null;
    }
}

// ============================================================================
// Token Extraction
// ============================================================================

/**
 * Extract the Cloudflare Access token from request headers
 * Checks Cf-Access-Jwt-Assertion header and CF_Authorization cookie
 */
export function extractCloudflareAccessToken(headers: Record<string, string | string[] | undefined>): string | null {
    // Primary: Cf-Access-Jwt-Assertion header (standard Cloudflare Access)
    const headerToken = headers["cf-access-jwt-assertion"];
    if (headerToken) {
        return Array.isArray(headerToken) ? headerToken[0] : headerToken;
    }

    // Fallback: CF_Authorization cookie
    const cookieHeader = headers["cookie"];
    if (cookieHeader) {
        const cookies = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
        const match = cookies.match(/CF_Authorization=([^;]+)/);
        if (match) {
            return match[1];
        }
    }

    return null;
}

/**
 * Extract Bearer token from Authorization header
 * Used for linked apps OAuth tokens
 */
export function extractBearerToken(headers: Record<string, string | string[] | undefined>): string | null {
    const authHeader = headers["authorization"];
    if (authHeader) {
        const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
        if (header.startsWith("Bearer ")) {
            return header.substring(7);
        }
    }
    return null;
}

/**
 * Check if a token looks like a JWT (has 3 base64url parts separated by dots)
 */
export function looksLikeJWT(token: string): boolean {
    if (!token || token.length < 20) return false;
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    // Check if parts look like base64url (quick check on first part is enough)
    return /^[A-Za-z0-9_-]+$/.test(parts[0]);
}

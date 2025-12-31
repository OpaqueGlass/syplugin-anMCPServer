import { logPush, errorPush } from "@/logger";
import { getPluginInstance } from "./pluginHelper";
import * as jose from "jose";

// Cache for JWKS to avoid fetching on every request
let jwksCache: jose.JSONWebKeySet | null = null;
let jwksCacheTime: number = 0;
const JWKS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

/**
 * Fetch JWKS (JSON Web Key Set) from Cloudflare Access
 */
async function fetchJWKS(teamDomain: string): Promise<jose.JSONWebKeySet> {
    const now = Date.now();

    // Return cached JWKS if still valid
    if (jwksCache && (now - jwksCacheTime) < JWKS_CACHE_DURATION) {
        return jwksCache;
    }

    const certsUrl = `${teamDomain}/cdn-cgi/access/certs`;
    logPush("Fetching Cloudflare Access JWKS from:", certsUrl);

    const response = await fetch(certsUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    jwksCache = data as jose.JSONWebKeySet;
    jwksCacheTime = now;

    return jwksCache;
}

/**
 * Validate a Cloudflare Access JWT token
 * @param token The JWT token from Cf-Access-Jwt-Assertion header
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

    try {
        // Normalize team domain (remove trailing slash)
        const teamDomain = config.teamDomain.replace(/\/$/, "");

        // Create remote JWKS
        const certsUrl = `${teamDomain}/cdn-cgi/access/certs`;
        const JWKS = jose.createRemoteJWKSet(new URL(certsUrl));

        // Verify the token
        const { payload } = await jose.jwtVerify(token, JWKS, {
            issuer: teamDomain,
            audience: config.policyAud,
        });

        logPush("Cloudflare Access token validated successfully for:", payload.email || payload.sub);
        return payload as CloudflareAccessPayload;
    } catch (err) {
        errorPush("Cloudflare Access token validation failed:", err);
        return null;
    }
}

/**
 * Extract the Cloudflare Access token from request headers
 * Checks Cf-Access-Jwt-Assertion header, CF_Authorization cookie, and Authorization Bearer
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
 * Check if a token looks like a JWT (has 3 base64 parts separated by dots)
 */
export function looksLikeJWT(token: string): boolean {
    if (!token) return false;
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    // Check if parts look like base64
    return parts.every(part => /^[A-Za-z0-9_-]+$/.test(part));
}

/**
 * Clear the JWKS cache (useful when configuration changes)
 */
export function clearJWKSCache(): void {
    jwksCache = null;
    jwksCacheTime = 0;
    logPush("Cloudflare Access JWKS cache cleared");
}

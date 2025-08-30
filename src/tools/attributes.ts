import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { addblockAttrAPI, getblockAttr } from "@/syapi";
import { getBlockDBItem } from "@/syapi/custom";
import { McpToolsProvider } from "./baseToolProvider";
import { isValidStr } from "@/utils/commonCheck";

import { lang } from "@/utils/lang";

export class AttributeToolProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [
            {
                name: "siyuan_set_block_attributes",
                description: "Set, update, or delete attributes for a specific block. To delete an attribute, set its value to an empty string.",
                schema: {
                    blockId: z.string().describe("The ID of the block to modify."),
                    attributes: z.record(z.string()).describe("An object of key-value pairs representing the attributes to set. Setting an attribute to an empty string ('') will delete it."),
                },
                handler: setBlockAttributesHandler,
                title: lang("tool_title_set_block_attributes"),
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: true, // Can delete attributes
                    idempotentHint: false,
                }
            },
            {
                name: "siyuan_get_block_attributes",
                description: "Get all attributes of a specific block.",
                schema: {
                    blockId: z.string().describe("The ID of the block to get attributes from."),
                },
                handler: getBlockAttributesHandler,
                title: lang("tool_title_get_block_attributes"),
                annotations: {
                    readOnlyHint: true,
                }
            }
        ];
    }
}

async function setBlockAttributesHandler(params, extra) {
    const { blockId, attributes } = params;

    if (!isValidStr(blockId)) {
        return createErrorResponse("blockId cannot be empty.");
    }

    const dbItem = await getBlockDBItem(blockId);
    if (dbItem == null) {
        return createErrorResponse("Invalid document or block ID. Please check if the ID exists and is correct.");
    }

    if (typeof attributes !== 'object' || attributes === null) {
        return createErrorResponse("attributes must be an object.");
    }

    const allowedNonCustomKeys = ['name', 'alias', 'memo', 'bookmark'];
    const customKeyRegex = /^[a-zA-Z0-9]+$/;

    for (const key in attributes) {
        if (key.startsWith('custom-')) {
            const customPart = key.substring('custom-'.length);
            if (!customKeyRegex.test(customPart)) {
                return createErrorResponse(`Invalid custom attribute name: '${key}'. The part after 'custom-' must only contain letters and(or) numbers.`);
            }
        } else if (!allowedNonCustomKeys.includes(key)) {
            return createErrorResponse(`Invalid attribute name: '${key}'. Attribute names must start with 'custom-' or be one of the following: ${allowedNonCustomKeys.join(', ')}.`);
        }
        if (typeof attributes[key] !== 'string') {
            return createErrorResponse(`Invalid value for attribute '${key}'. Attribute values must be strings.`);
        }
    }

    try {
        const result = await addblockAttrAPI(attributes, blockId);
        if (result === 0) {
            return createSuccessResponse("Attributes updated successfully.");
        } else {
            return createErrorResponse("Failed to update attributes.");
        }
    } catch (error) {
        return createErrorResponse(`An error occurred: ${error.message}`);
    }
}

async function getBlockAttributesHandler(params, extra) {
    const { blockId } = params;

    if (!isValidStr(blockId)) {
        return createErrorResponse("blockId cannot be empty.");
    }

    const dbItem = await getBlockDBItem(blockId);
    if (dbItem == null) {
        return createErrorResponse("Invalid document or block ID. Please check if the ID exists and is correct.");
    }

    try {
        const attributes = await getblockAttr(blockId);
        // The API returns an empty object if there are no attributes, which is a valid JSON response.
        return createJsonResponse(attributes ?? {});
    } catch (error) {
        return createErrorResponse(`An error occurred: ${error.message}`);
    }
}

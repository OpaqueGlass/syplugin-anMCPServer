import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { getBackLink2T, getChildBlocks, getFileAPIv2, getNodebookList, insertBlockAPI, insertBlockOriginAPI, listDocsByPathT, listDocTree, putStringFile, removeFileAPI, renderSprig, renderTemplate, searchTemplate } from "@/syapi";
import { McpToolsProvider } from "./baseToolProvider";
import { debugPush, logPush, warnPush } from "@/logger";
import { getBlockDBItem, getChildDocumentIds, getDocDBitem, getSubDocIds } from "@/syapi/custom";
import { filterBlock } from "@/utils/filterCheck";
import { isValidHTML, validatePath } from "@/utils/commonCheck";
import { wrapTemplateFilePath } from "@/utils/common";
import item from "element-plus/lib/components/space/src/item.js";

export class TemplateToolProvider extends McpToolsProvider<any> {
    async _getTools(): Promise<McpTool<any>[]> {
        return [
            {
                name: "siyuan_create_template",
                description: "Create a new template file or overwrite an existing one in the SiYuan workspace. This allows users to save reusable content structures for future note creation.",
                schema: {
                    name: z.string().describe("The name of the template file (e.g., 'daily-log', 'dailynote/folder'). Must be a valid filename."),
                    content: z.string().describe("The raw content/string of the template."),
                    override: z.boolean().optional().describe("If true, overwrites the existing template with the same name. Defaults to false.")
                },
                handler: createTemplate,
                title: "Create Template",
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: false,
                    idempotentHint: false
                }
            },
            {
                name: "siyuan_search_template",
                description: "Search for existing templates within the workspace using a keyword. Returns a list of template names that match the search criteria.",
                schema: {
                    k: z.string().describe("The keyword to search for in template names. Could be empty to return all templates.")
                },
                handler: searchTemplateTool,
                title: "Search Templates",
                annotations: {
                    readOnlyHint: true,
                    destructiveHint: false,
                    idempotentHint: true
                }
            },
            {
                name: "siyuan_render_template",
                title: "Apply Template to Document",
                description: "Renders a template and INSERTS the result directly into the specified document. Use this when you want to modify the document by prepending template-generated content.",
                schema: {
                    id: z.string().describe("The ID of the target document where the template content will be inserted."),
                    name: z.string().describe("The name of the template file to execute.")
                },
                handler: renderTemplateToDocTool,
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: false,
                    idempotentHint: false
                }
            },
            {
                name: "siyuan_preview_rendered_template",
                title: "Preview Template Result",
                description: "Generates the rendered Markdown string of a template without modifying the document. Use this to check the output or get the content for further processing before any insertion.",
                schema: {
                    id: z.string().describe("The ID of the document to provide data context for rendering."),
                    name: z.string().describe("The name of the template file to preview.")
                },
                handler: previewRenderedTemplateTool,
                annotations: {
                    readOnlyHint: true,
                    destructiveHint: false,
                    idempotentHint: false
                }
            },
            {
                name: "siyuan_get_raw_template",
                description: "Retrieve the raw source content of a specified template file. Useful for inspecting or editing the template structure.",
                schema: {
                    name: z.string().describe("The name of the template whose content you want to retrieve.")
                },
                handler: getRawTemplate,
                title: "Get Template Source",
                annotations: {
                    readOnlyHint: true,
                    destructiveHint: false,
                    idempotentHint: true
                }
            },
            {
                name: "siyuan_remove_template",
                description: "Delete a specified template file from the workspace. This action is permanent.",
                schema: {
                    name: z.string().describe("The name of the template file to be removed.")
                },
                handler: removeTemplate,
                title: "Remove Template",
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: true,
                    idempotentHint: false
                }
            },
            {
                name: "siyuan_render_sprig_template",
                description: "Render a Sprig template with the specified content.",
                schema: {
                    sprigTemplate: z.string().describe("The Sprig template content to be rendered.")
                },
                handler: renderSprigTool,
                title: "Render Sprig Template",
                annotations: {
                    readOnlyHint: true,
                    destructiveHint: false,
                    idempotentHint: false
                }
            }
        ];
    }
}

async function createTemplate(params, extra) {
    const { name, content, override } = params;
    const pathValidateResult = validateTemplateName(name);
    if (!pathValidateResult.isValid) {
        return createErrorResponse("Invalid path: " + pathValidateResult.reason);
    }
    const existFile = await getFileAPIv2(wrapTemplateFilePath(name));
    if (existFile && !override) {
        return createErrorResponse("Template file already exists with name: " + name);
    }
    const result = await putStringFile(wrapTemplateFilePath(name), content);
    return createSuccessResponse("Template created successfully: " + name);
}

async function searchTemplateTool(params, extra) {
    const { k } = params;
    const response = await searchTemplate(k);
    const result = [];
    for (const item of response) {
        result.push({
            name: item.content,
        });
    }
    return createJsonResponse(result);
}


async function previewRenderedTemplateTool(params, extra) {
    const { id, name } = params;
    const doc = await getDocDBitem(id);
    if (doc == null) {
        return createErrorResponse("Document not found with id: " + id);
    }
    const filterResult = await filterBlock(id, doc);
    if (filterResult) {
        return createErrorResponse("The specified document is filtered and cannot be used as template context.");
    }
    const validateResult = validateTemplateName(name);
    if (!validateResult.isValid) {
        return createErrorResponse("Invalid template name: " + validateResult.reason);
    }
    const templateItem = await getTemplateItemByName(name);
    if (templateItem) {
        const template = await renderTemplate(id, templateItem.path);
        const testLute = window.Lute.New();
        const test = testLute.BlockDOM2Md(template);
        return createJsonResponse({
            "renderedMarkdown": test,
        });
    }
    return createErrorResponse("Template not found: " + name);
}

async function renderTemplateToDocTool(params, extra) {
    const { id, name } = params;
    const doc = await getDocDBitem(id);
    if (doc == null) {
        return createErrorResponse("Document not found with id: " + id);
    }
    const filterResult = await filterBlock(id, doc);
    if (filterResult) {
        return createErrorResponse("The specified document is filtered and cannot be used as template context.");
    }
    const validateResult = validateTemplateName(name);
    if (!validateResult.isValid) {
        return createErrorResponse("Invalid template name: " + validateResult.reason);
    }
    const templateItem = await getTemplateItemByName(name);
    if (templateItem) {
        const template = await renderTemplate(id, templateItem.path);
        const insertResult = await insertBlockAPI(template, id, "PARENT", "dom");
        return createSuccessResponse("Template rendered and inserted successfully with new block ID: " + insertResult.id);
    }
    return createErrorResponse("Template not found: " + name);
}

async function getRawTemplate(params, extra) {
    const { name } = params;
    const validateResult = validateTemplateName(name);
    if (!validateResult.isValid) {
        return createErrorResponse("Invalid template name: " + validateResult.reason);
    }
    const templateItem = await getTemplateItemByName(name);
    if (templateItem) {
        const fileResponse = await getFileAPIv2(templateItem.path.replaceAll(window.siyuan.config.system.workspaceDir, ""));
        if (!fileResponse) {
            return createErrorResponse("Failed to retrieve template file: " + name);
        }
        if (fileResponse instanceof Blob) {
            return createSuccessResponse(await fileResponse.text());
        }
        return createSuccessResponse(fileResponse);
    }
    return createErrorResponse("Template not found: " + name);
}

async function removeTemplate(params, extra) {
    const { name } = params;
    const validateResult = validateTemplateName(name);
    if (!validateResult.isValid) {
        return createErrorResponse("Invalid template name: " + validateResult.reason);
    }
    const response = await removeFileAPI(wrapTemplateFilePath(name));
    if (response) {
        return createSuccessResponse("Template removed successfully: " + name);
    } else {
        return createErrorResponse("Failed to remove template: " + name);
    }
}

async function renderSprigTool(params, extra) {
    const { sprigTemplate } = params;
    const response = await renderSprig(sprigTemplate);
    return createSuccessResponse(response);
}

function validateTemplateName(path: string): { isValid: boolean; reason?: string } {
    if (!path || typeof path !== 'string' || path.trim() === '') {
        return { isValid: false, reason: "路径不能为空" };
    }
    if (path.startsWith('/') || path.startsWith('\\')) {
        return { isValid: false, reason: "路径不能以 '/' 或 '\\' 开头，请使用相对路径" };
    }
    if (path.endsWith('/') || path.endsWith('\\')) {
        return { isValid: false, reason: "路径不能以 '/' 或 '\\' 结尾" };
    }
    return validatePath(path);
}

async function getTemplateItemByName(name: string): Promise<{ "content": string, "path": string } | null> {
    const response = await searchTemplate(name.replaceAll("/", " "));
    if (!response.length) {
        return null;
    }
    for (const item of response) {
        const cleanedName = item.content.replaceAll("<mark>", "").replaceAll("</mark>", "");
        if (cleanedName === name || (cleanedName.indexOf("/") === 0 && cleanedName.substring(1) === name)) {
            return item;
        }
    }
    return null;
}

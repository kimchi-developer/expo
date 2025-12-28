"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rscOutputKeySerializerPlugin = rscOutputKeySerializerPlugin;
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = require("node:url");
const debug = require('debug')('expo:rsc-output-key');
/**
 * Convert Windows paths to POSIX format for consistent output keys.
 */
function toPosixPath(filePath) {
    return filePath.replace(/\\/g, '/');
}
/**
 * Resolve a file:// URL to an output key.
 *
 * - Package files (node_modules): returns path after last /node_modules/
 *   This handles pnpm's .pnpm directory structure by using lastIndexOf.
 * - App files: returns a relative path from project root (e.g., "./app/components/Button.tsx")
 *
 * The output key format must match the SSR manifest generation in MetroBundlerDevServer.ts
 * to ensure consistency between react-server and client bundles.
 */
function resolveOutputKey(fileUrl, projectRoot) {
    const absolutePath = (0, node_url_1.fileURLToPath)(fileUrl);
    // Package files: use path after last /node_modules/
    // This handles pnpm's structure: node_modules/.pnpm/pkg@1.0/node_modules/pkg/...
    // lastIndexOf ensures we get "pkg/..." not ".pnpm/pkg@1.0/node_modules/pkg/..."
    if (absolutePath.includes('/node_modules/')) {
        const nodeModulesIndex = absolutePath.lastIndexOf('/node_modules/');
        const packageRelativePath = absolutePath.slice(nodeModulesIndex + '/node_modules/'.length);
        debug('Resolved %s -> %s (node_modules)', fileUrl, packageRelativePath);
        return packageRelativePath;
    }
    // App files: use relative path from project root
    const relativePath = './' + toPosixPath(node_path_1.default.relative(projectRoot, absolutePath));
    debug('Resolved %s -> %s (app)', fileUrl, relativePath);
    return relativePath;
}
/**
 * Replace file:// URLs in the code with stable output keys.
 *
 * Only replaces URLs that point to files within the project (projectRoot).
 * This avoids transforming unrelated file:// URLs in test code or other contexts.
 *
 * Matches patterns like:
 * - createClientModuleProxy("file:///path/to/project/file.js")
 * - createServerReference("file:///path/to/project/file.js#exportName", ...)
 */
function replaceFileUrlsInCode(code, projectRoot) {
    // Match file:// URLs with absolute paths (file:///absolute/path)
    // Only match URLs with three slashes (Unix absolute path) to avoid matching
    // template literals like `file://${variable}` in bundled code.
    // The URL may have a hash fragment for server action exports.
    return code.replace(/file:\/\/\/[^"'#`]+(?:#[^"'`]*)?/g, (match) => {
        // Split off the hash fragment if present (for server actions: "file://...#exportName")
        const hashIndex = match.indexOf('#');
        const fileUrl = hashIndex >= 0 ? match.substring(0, hashIndex) : match;
        const hash = hashIndex >= 0 ? match.substring(hashIndex) : '';
        // Only transform URLs that point to files within the project
        // This avoids transforming unrelated file:// URLs (e.g., file:///android_res/)
        const absolutePath = (0, node_url_1.fileURLToPath)(fileUrl);
        if (!absolutePath.startsWith(projectRoot)) {
            return match; // Keep original, not a project file
        }
        const outputKey = resolveOutputKey(fileUrl, projectRoot);
        return outputKey + hash;
    });
}
/**
 * Serializer plugin that replaces file:// URL placeholders with stable output keys.
 *
 * This plugin runs after reconcileTransformSerializerPlugin and replaces file:// URLs
 * (inserted by babel plugins) with stable output keys.
 *
 * Why this approach?
 * 1. Babel runs in worker processes without access to the dependency graph
 * 2. The serializer runs in the main process and can normalize paths
 *
 * The output key format:
 * - node_modules files: path after last /node_modules/ (handles pnpm)
 * - app files: ./ + relative path from project root
 *
 * This must match the SSR manifest generation in MetroBundlerDevServer.ts.
 */
async function rscOutputKeySerializerPlugin(entryPoint, preModules, graph, options) {
    const projectRoot = options.projectRoot;
    if (!projectRoot) {
        debug('No projectRoot found, skipping RSC output key resolution');
        return [entryPoint, preModules, graph, options];
    }
    const environment = graph.transformOptions?.customTransformOptions?.environment;
    // Replace file:// URLs in each module's code
    for (const module of graph.dependencies.values()) {
        for (const output of module.output) {
            if ('code' in output.data && typeof output.data.code === 'string') {
                const originalCode = output.data.code;
                const newCode = replaceFileUrlsInCode(originalCode, projectRoot);
                if (newCode !== originalCode) {
                    debug('Replaced file:// URLs in %s (env=%s)', module.path, environment);
                    output.data.code = newCode;
                }
            }
        }
    }
    debug('Replaced file:// URLs with output keys (env=%s)', environment);
    return [entryPoint, preModules, graph, options];
}
//# sourceMappingURL=rscOutputKeySerializerPlugin.js.map
/**
 * webpack.cli.config.js
 * CLI（Node.js / npx）构建配置，与插件构建（webpack.config.js）互相独立。
 *
 * 产物：bin/mcp-server.js（单文件，可直接 node 运行 / npx 调用）
 * 差异点：
 *  - target: node（不再是 electron-renderer）
 *  - "siyuan" 模块 alias 到 src/cli/siyuanStub.ts（无前端环境）
 *  - 依赖全部打包进产物（无 externals），便于 npx 直接运行
 */
const path = require("path");
const webpack = require("webpack");
const { EsbuildPlugin } = require("esbuild-loader");

module.exports = (env, argv) => {
    const isPro = argv.mode === "production";
    return {
        mode: argv.mode || "development",
        devtool: false,
        target: "node",
        entry: {
            "mcp-server": "./src/nodeIndex.ts",
        },
        output: {
            filename: "[name].js",
            path: path.resolve(__dirname, "bin"),
            libraryTarget: "commonjs2",
        },
        node: {
            __dirname: false,
            __filename: false,
        },
        optimization: {
            minimize: isPro,
            minimizer: [new EsbuildPlugin({ target: "node18" })],
        },
        resolve: {
            extensions: [".ts", ".js", ".json"],
            alias: {
                "@": path.resolve(__dirname, "src"),
                // CLI 环境没有思源前端模块，替换为 stub
                "siyuan": path.resolve(__dirname, "src/cli/siyuanStub.ts"),
            },
        },
        module: {
            rules: [
                {
                    test: /\.ts(x?)$/,
                    include: [path.resolve(__dirname, "src")],
                    use: [
                        {
                            loader: "esbuild-loader",
                            options: {
                                target: "node18",
                                loader: "ts",
                            },
                        },
                    ],
                },
                {
                    test: /\.md$/,
                    include: [path.resolve(__dirname, "static")],
                    use: "raw-loader",
                },
            ],
        },
        plugins: [
            new webpack.BannerPlugin({
                banner: "#!/usr/bin/env node",
                raw: true,
                entryOnly: true,
            }),
        ],
    };
};

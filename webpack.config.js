const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const {EsbuildPlugin} = require("esbuild-loader");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");
const {VueLoaderPlugin} = require('vue-loader')

// 使用change-dir命令更改dev的目录
const devDistDirInfo = "./scripts/devInfo.json";
const loadDirJsonContent = fs.existsSync(devDistDirInfo)
  ? JSON.parse(fs.readFileSync(devDistDirInfo, "utf-8"))
  : {};
const devDistDir = loadDirJsonContent["devDir"] ?? "./dev";
const distDir = devDistDir

module.exports = (env, argv) => {
    const isPro = argv.mode === "production";
    const plugins = [
        new VueLoaderPlugin(),
        new MiniCssExtractPlugin({
            filename: isPro ? "dist/index.css" : "index.css",
        })
    ];
    let entry = {
        "index": "./src/index.ts",
    };
    if (isPro) {
        entry = {
            "dist/index": "./src/index.ts",
        };
        plugins.push(new webpack.BannerPlugin({
            banner: () => {
                return fs.readFileSync("LICENSE").toString();
            },
        }));
        plugins.push(new CopyPlugin({
            patterns: [
                {from: "preview.png", to: "./dist/"},
                {from: "icon.png", to: "./dist/"},
                {from: "README*.md", to: "./dist/"},
                {from: "plugin.json", to: "./dist/"},
                {from: "LICENSE", to: "./dist/"},
                {from: "CHANGELOG.md", to: "./dist/"},
                {from: "src/i18n/", to: "./dist/i18n/"},
            ],
        }));
        plugins.push(new ZipPlugin({
            filename: "package.zip",
            algorithm: "gzip",
            include: [/dist/],
            pathMapper: (assetPath) => {
                return assetPath.replace("dist/", "");
            },
        }));
    } else {
        plugins.push(new CopyPlugin({
            patterns: [
                {from: "src/i18n/", to: "./i18n/"},
                {from: "preview.png", to: ".x"},
                {from: "icon.png", to: "."},
                {from: "README*.md", to: "."},
                {from: "plugin.json", to: ""},
                {from: "LICENSE", to: "."},
            ],
        }));
    }
    return {
        mode: argv.mode || "development",
        watch: !isPro,
        devtool: isPro ? false : "eval",
        target: "electron-renderer",
        output: {
            filename: "[name].js",
            path: isPro ? path.resolve(__dirname) : distDir,//path.resolve(__dirname, 'dist'),
            libraryTarget: "commonjs2",
            library: {
                type: "commonjs2",
            },
        },
        externals: {
            siyuan: "siyuan",
        },
        entry,
        optimization: {
            minimize: true,
            minimizer: [
                new EsbuildPlugin(),
            ],
        },
        resolve: {
            extensions: [".ts", ".scss", ".js", ".json", ".vue"],
            alias: {
                "@": path.resolve(__dirname, "src"),
                // 'vue$': 'vue/dist/vue.esm-bundler.js'
            },
        },
        module: {
            rules: [
                {
                    test: /\.vue$/,
                    use: 'vue-loader'
                },
                {
                    test: /\.ts(x?)$/,
                    include: [path.resolve(__dirname, "src")],
                    use: [
                        {
                            loader: "esbuild-loader",
                            options: {
                                target: "es6",
                                loader: 'ts'
                            }
                        },
                    ],
                },
                // {
                //     test: /\.ts$/,
                //     loader: 'ts-loader',
                //     options: {
                //         appendTsSuffixTo: [/\.vue$/]
                //     }
                // },
                {
                    test: /\.scss$/,
                    include: [path.resolve(__dirname, "src")],
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: "css-loader", // translates CSS into CommonJS
                        },
                        {
                            loader: "sass-loader", // compiles Sass to CSS
                        },
                    ],
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader']
                },
                {
                    test: /\.md$/,
                    include: [path.resolve(__dirname, "static")],
                    use: 'raw-loader',
                }
            ],
        },
        plugins,
    };
};

const path = require('path');
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

module.exports = {
    entry: './src/script.ts',
    watchOptions: {
        ignored: '**/node_modules',
    },
    cache: {
        type: 'filesystem',
        allowCollectingMemory: true,
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            configFile: require.resolve("./tsconfig.json"),
                        }
                    }
                ],
                exclude: ["/node_modules", "/app", "/dist"],
            },
            {
                test: /\.html?$/,
                use: [
                    {
                        loader: 'html-loader'
                    }
                ],
                exclude: ["/node_modules", "/app", "/dist"],
            },
            {
                test: /\.s?[ac]ss$/i,
                use: [
                    "style-loader",
                    // Translates CSS into CommonJS
                    {
                        loader: "css-loader"
                    },
                    {
                        loader: "sass-loader",
                        options: {
                            sassOptions: {
                                modules: true,
                            }
                        }
                    }
                ]
            }
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'app')
    },
    plugins: [new HtmlWebpackPlugin({
        template: "./src/index.html",
        inject: "head"
    })],
};
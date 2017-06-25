module.exports = {
    entry: `${__dirname}/_src/main.ts`,

    output: {
        path: `${__dirname}/assets/js`,
        publicPath: '/assets/js',
        filename: '[name].min.js'
    },

    resolve: {
        extensions: ['.ts', '.js']
    },

    devtool: 'sourcemap',

    module: {
        loaders: [
            {
                test: /\.ts$/,
                loader: 'awesome-typescript-loader'
            },
            {
                test: /\.css$/,
                loaders: ['style-loader', 'css-loader']
            }
        ]
    }
};

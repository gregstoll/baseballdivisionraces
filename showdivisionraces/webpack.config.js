const path = require('path')
const CopyPlugin = require('copy-webpack-plugin');

const paths = {
  src: path.join(__dirname, 'src'),
  dist: path.join(__dirname, 'dist'),
  sourcemlbdata: path.join(__dirname, '..', 'getmlbstandings', 'data'),
  distdata: path.join(__dirname, 'dist', 'data'),
  public: path.join(__dirname, 'public')
}

module.exports = {
  mode: 'development',
  context: paths.src,
  entry: ['./app.ts'],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {from: paths.public, to: paths.dist},
        {from: paths.sourcemlbdata, to: paths.distdata}
      ]
    }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  output: {
    filename: 'app.bundle.js',
    //path: path.resolve(paths.dist, "dist"),
    path: paths.dist,
    publicPath: 'dist',
  },
  devtool: 'inline-source-map',
  devServer: {
    contentBase: paths.dist,
    publicPath: "/dist"
  },
}

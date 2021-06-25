var fs = require('fs');

var filename = "dist/index.html";

fs.readFile(filename, 'utf8', function (err, contents) {
    if (err) {
        return console.error(err);
    }
    contents = contents.replace(/<ssihead\s?\/>/gi, "<!--#include virtual=\"/bootstraphead.html\"-->");
    contents = contents.replace(/<ssibodytop\s?\/>/gi, "<!--#include virtual=\"/navbar.html\"-->");
    contents = contents.replace(/<ssibodybottom\s?\/>/gi, "<!--#include virtual=\"/endOfBody.html\"-->");

    fs.writeFile(filename, contents, 'utf8', function (err) {
        if (err) {
            return console.error(err);
        }
        fs.chmod(filename, 0o775, function (err) {
            if (err) {
                return console.error(err);
            }
        });
    });
});

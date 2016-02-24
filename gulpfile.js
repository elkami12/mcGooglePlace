var args = require('yargs').argv;
var fs = require('fs');
var gulp = require('gulp');
var $ = require('gulp-load-plugins')({
    lazy: true
});
var input = {
        'javascript': [
            'src/**/*.module.js',
            'src/**/*.js'
        ]
    },

    output = {
        'dest': 'dist/',
        'file': 'mc-google-place.js',
        'min': 'mc-google-place.min.js'
    };

/* run the watch task when gulp is called without arguments */
gulp.task('default', ['build-js']);

/**
 * vet the code and create coverage report
 * @return {Stream}
 */
gulp.task('vet', function() {
    log('Analyzing source with JSHint and JSCS');

    return gulp
        .src(input.javascript)
        .pipe($.if(args.verbose, $.print()))
        .pipe($.jshint())
        .pipe($.jshint.reporter('jshint-stylish', {
            verbose: true
        }))
        .pipe($.jshint.reporter('fail'))
        .pipe($.jscs());
});

/* concat javascript files */
gulp.task('concat', ['vet'], function() {
    return gulp.src(input.javascript)
        .pipe($.sourcemaps.init())
        .pipe($.concat(output.file))
        .pipe($.sourcemaps.write())
        .pipe($.header(getCopyright()))
        .pipe(gulp.dest(output.dest));
});

/* minify */
gulp.task('uglify', ['concat'], function() {
    return gulp.src(output.dest + output.file)
        .pipe($.uglify())
        .pipe($.rename(output.min))
        .pipe(gulp.dest(output.dest));
});

/**
 * Log a message or series of messages using chalk's blue color.
 * Can pass in a string, object or array.
 */
function log(msg) {
    if (typeof(msg) === 'object') {
        for (var item in msg) {
            if (msg.hasOwnProperty(item)) {
                $.util.log($.util.colors.blue(msg[item]));
            }
        }
    } else {
        $.util.log($.util.colors.blue(msg));
    }
}

// Get copyright using NodeJs file system
function getCopyright() {
    return fs.readFileSync('Copyright');
};

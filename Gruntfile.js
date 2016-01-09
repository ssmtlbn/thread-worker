module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      source: {
        options: {
          sourceMap: true,
          banner: '/*!\n' 
                  + 'ThreadWorker v<%= pkg.version %> \n'
                  + '(c) 2015 Samuel Samtleben \n'
                  + 'License: MIT \n'
                  + '*/\n' 
                  + '(function(root, factory) { \n'
                    + '\tif (typeof define === "function" && define.amd) {\n'
                      + '\t\tdefine(factory);\n'
                    + '\t} else if (typeof exports === "object") {\n'
                      + '\t\tmodule.exports = factory(); \n'
                    + '\t} else { \n'
                      + '\t\troot.threadWorker = factory();\n'
                    + '\t}\n'
                  + '}(this, function () {\n'
                    + '\tvar exports = {};\n',
          footer: '\nreturn exports;\n' 
                  + '}));'
        },
        src: ['src/**/*.js', '!src/eval-worker.js'],
        dest: 'dist/thread-worker.js'
      }
    },
    copy: {
      default: {
        src: 'src/eval-worker.js',
        dest: 'dist/eval-worker.js'
      }
    },
    uglify: {
      options: {
        sourceMap: true
      },
      main: {
        options: {
          banner: '/*!\n' 
                    + 'ThreadWorker v<%= pkg.version %> \n'
                    + '(c) 2015 Samuel Samtleben \n'
                    + 'License: MIT \n'
                    + '*/\n'
        },     
        files: {
          'dist/thread-worker.min.js': ['dist/thread-worker.js']
        }
      },
      evalWorker: {
        files: {
          'dist/eval-worker.min.js': ['dist/eval-worker.js']
        }
      }
    },
    clean: {
      doc: {
        src: ['doc/*']
      }
    },
    jsdoc: {
      source: {
        src: ['README.md', 'src/**/*.js'],
        options: {
          dest: 'doc',
          private: false
        }
      }
    }
  });
  
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadNpmTasks('grunt-contrib-clean');
  
  grunt.registerTask('default', ['concat:source', 'copy:default', 
    'uglify:main', 'uglify:evalWorker']);
  
  grunt.registerTask('doc', ['clean:doc', 'jsdoc:source']);
  
};

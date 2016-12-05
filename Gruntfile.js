/**
 * Created by rkhabibullin on 05.12.2016.
 */
module.exports = function(grunt) {

    grunt.initConfig({
        bowercopy: {
            options: {
                destPrefix: 'www/lib',
                clear:true
            },
            lib: {
                files:{
                    'angular.min.js':'angular/angular.min.js',
                    'angular-route.min.js':'angular-route/angular-route.min.js',
                    'angular-strap.min.js':'angular-strap/dist/angular-strap.min.js',
                    'angular-strap.tpl.min.js':'angular-strap/dist/angular-strap.tpl.min.js',
                    'bs/css/bootstrap.min.css':'bootstrap/dist/css/bootstrap.min.css',
                    'bs/css/bootstrap-theme.min.css':'bootstrap/dist/css/bootstrap-theme.min.css',
                    'bs/fonts':'bootstrap/dist/fonts/*',
                    'fa/css/font-awesome.min.css':'font-awesome/css/font-awesome.min.css',
                    'fa/fonts':'font-awesome/fonts/*',
                    'angular-sanitize.min.js':'angular-sanitize/angular-sanitize.min.js',
                    'angular-websocket.min.js':'angular-websocket/dist/angular-websocket.min.js'
                }
            }
        },
        reload: {
            homepage: {
                options: {
                    url: 'http://localhost:9070/',
                    match: 'Chat test app'
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-bowercopy');
    grunt.loadNpmTasks('grunt-reload-chrome');

};
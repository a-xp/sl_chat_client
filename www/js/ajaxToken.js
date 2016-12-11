/**
 * Created by rkhabibullin on 05.12.2016.
 */
var module = angular.module('ajaxToken', []);
module.factory('token', function($rootScope){
   var id = null;
    $rootScope.$on('set-token', function(e, token){
       id = token; 
    });
    return function(){
       return id;
   }
});
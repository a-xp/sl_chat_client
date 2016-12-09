/**
 * Created by rkhabibullin on 05.12.2016.
 */
var module = angular.module('ajaxToken', []);
module.factory('token', function(){
   return function(){
       return "654";
   }
});
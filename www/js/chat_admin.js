/**
 * Created by 1 on 10.12.2016.
 */
var app = angular.module('chatApp');
app.factory('chatAdminService', function($http, adminApiUrl){

    var service = {
      createGroup: function(name){
          return $http.post(adminApiUrl+'group', {name:name}).then(function(result){
              return result.data;
          })
      },
      getGroups: function(){
          return $http.get(adminApiUrl+'group').then(function(result){
              return result.data;
          })
      },
      addUser: function(id, name, lastName, role, login){
          return $http.post(adminApiUrl+'user', {id:parseInt(id), name:name, lastName:lastName, role:role, login:login}).then(function(result){
              return result.data;
          })
      },
       getUsers: function(){
        return $http.get(adminApiUrl+'user').then(function(result){
            return result.data;
        })    
       } 
    };
    return service;
});
app.controller('adminCtrl', function($scope, chatAdminService){
   $scope.as = chatAdminService;

    $scope.showResult= function(promise){
        promise.then(function(result){
            $scope.result = result;
        }, function(e){
            $scope.result = e;
        })
    };
    
    $scope.addTestData = function(){
        
        var users =    [{id:355258, login:'LRuzhenkoMSK', name:'Ирина', lastName:'Рыденко', role:"user"},
            {id:355259, login:'NMelnikovaMSK', name:'Елена', lastName:'Сиренина', role:"admin"},
            {id:356200, login:'LSosnenkoMSK', name:'Елена', lastName:'Николашкина', role:"user"},
            {id:356201, login:'LKazantsevaMSK', name:'Екатерина', lastName:'Медникова', role:"user"},
            {id:356624, login:'NSukhorukovKLF',name:'Ольга', lastName:'Павликова', role:"user"}];

        var groups = [{name: 'Операторы СКС'}, {name: 'Операторы КЦ'}];

        angular.forEach(users, function(u){ chatAdminService.addUser(u.id, u.name, u.lastName, u.role, u.login)});
        angular.forEach(groups, function (g) { chatAdminService.createGroup(g.name)})
    }
});

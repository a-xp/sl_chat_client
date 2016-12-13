/**
 * Created by rkhabibullin on 05.12.2016.
 */
var app = angular.module('chatApp', ['mgcrea.ngStrap', 'ngSanitize', 'ajaxToken', 'ngWebSocket', 'ngRoute']);
app.constant('serviceUrl', 'ws://localhost:9100/chat');
app.constant('adminApiUrl', 'http://127.0.0.1:9100/admin/');
app.config(function($routeProvider) {
    $routeProvider.when("/login", {
        templateUrl: '/tpl/login.html',
        controller: 'loginCtrl'
    }).when("/chat", {
        templateUrl: '/tpl/chat.html',
        controller: 'chatCtrl'
    }).when("/admin", {
        templateUrl: '/tpl/admin.html',
        controller: 'adminCtrl'
    }).otherwise('/login');
});
app.run( function($rootScope, token, $location) {
    $rootScope.$on( "$routeChangeStart", function(event, next, current) {
        if (!token() && next.templateUrl != "/tpl/login.html" && next.templateUrl != "/tpl/admin.html") {
            $location.path( "/login" );
        }
    });
});
app.factory('contactsService', function($websocket, serviceUrl, token, $q){
    var stream;
    function request(cmdType, data){
        service.processing++;
        var rd = angular.extend({}, data, {jsonClass:'ChatService$'+cmdType});
        return stream.send(rd).finally(function(){
            service.processing--;
        });
    }
    var service = {
        connected: false,
        contacts: null,
        groups: null,
        dialog: null,
        user: null,
        connect: function(){
          if(stream){
              stream.close();
          }
          stream = $websocket(serviceUrl);
          setMsgCb();
          service.token(token());
        },
        close: function(){
            service.connected = false;
            stream.close();
        },
        token: function(token){
            return request('TokenCmd', {token:token})
        },
        startDlg : function(toWhom){
          return request('StartDlgCmd', {toWhom: [toWhom]});
        },
        openDlg: function(contact_id){
            return request('OpenDlgCmd', {dlgId:contact_id});
        },
        closeDlg: function(){
            service.dialog = null;
        },
        read: function(contact_id){
            return request('ReadCmd', {contact:contact_id})
        },
        sendMsg: function(msg){
            if(service.dialog){
                return request('MsgCmd', {contact:service.dialog.id, msg:msg})
            }else{
                return $q.reject("Invalid state");
            }
        },
        broadcastMsg: function(msg, groupId){
            return request('BroadcastCmd', {group:groupId, msg:msg})
        },
        typing: function(){
            return request('TypingCmd')
        },
        processing:false
    };

    function setMsgCb() {
        stream.onMessage(function (msg) {
            console.log(msg);
            var data = JSON.parse(msg.data);
            switch (data.jsonClass) {
                case 'ChatService$InfoResult':
                    service.user = {role: data.role, roleName:data.roleName};
                    service.connected = true;
                    break;
                case 'ChatService$GroupsResult':
                    service.groups = data.groups;
                    break;
                case 'ChatService$ContactsResult':
                    service.contacts = data.contacts;
                    break;
                case 'ChatService$dialog':
                    service.dialog = data.dialog;
                    break;
                case 'ChatService$contact':
                    var i = -1;
                    angular.forEach(service.contacts, function (v, k) {
                        if (v.id == data.id)i = k;
                    });
                    if (i >= 0) {
                        service.contacts[k] = data.contact;
                    } else {
                        service.contacts.push(data.contact);
                    }
                    if (dialog.id == data.id) {
                        service.read(data.id)
                    }
                    break;
                case 'ChatService$msg':
                    if (service.dialog && data.contact_id == service.dialog.id) {
                        angular.extend(service.dialog.msg, data.msg);
                    }
                    break;
            }
        });
    }

    return service;
});

app.controller('chatCtrl', function($scope, $filter, contactsService){
    function updateContacts(){
        if($scope.cs.contacts){
            $scope.tabs.last = $filter('orderBy')($scope.cs.contacts, ['-hasNew', '-last']).slice(0, 5);
            $scope.tabs.all = $filter('orderBy')($scope.cs.contacts, 'login');
            $scope.tabs.new = $filter('filter')($scope.cs.contacts, {hasNew:true}, true);
        }else{
            $scope.tabs = {
                last:[], all:[], new:[]
            }
        }
    }
    contactsService.connect();
    $scope.cs = contactsService;
    $scope.chat ={
        open: false,
        contactTab: 'last',
        broadcast:null
    };
    $scope.$watchCollection('cs.contacts', updateContacts);
    $scope.tabs = {
        new: [],
        last: [],
        all: [],
        group: $scope.cs.groups
    };
    if($scope.cs.contacts && $scope.cs.contacts.length)updateContacts();
    $scope.openDialog = function(dialog){
        $scope.chat.broadcast = null;
        if(dlg.id){
            $scope.cs.openDlg(dialog.id);
        }else{
            $scope.cs.startDlg(dialog.toWhom);
        }
    };
    $scope.openGroup = function (group) {
        $scope.cs.close();
        $scope.chat.broadcast = group;
    };
    $scope.sendMsg = function(){
        $scope.cs.sendMsg($scope.chat.dialogText);
        $scope.chat.dialogText = '';
    };
    $scope.broadcast = function(){
        $scope.cs.broadcastMsg($scope.chat.broadcast.id, $scope.chat.broadcastText);
        $scope.chat.broadcastText ='';
    }
});
app.controller('loginCtrl', function($scope, $location, $rootScope, chatAdminService){

    chatAdminService.getUsers().then(function(list){
        angular.forEach(list, function(v){
            $scope.logins.push({id:v.crmId, login:v.login});
        })
    });
    $scope.logins = [];
    $scope.userId = null;

   $scope.login = function(){
    if($scope.userId) {
        $scope.$emit('set-token', $scope.userId);
        $location.path("/chat");
    }       
   } 
});
app.filter('shortDate', function($filter){
   var filterDate = $filter('date');
   function isToday(date){
       var today = new Date();
       return today.getDate()==date.getDate() && today.getMonth()==date.getMonth() && today.getYear()==date.getYear();
   }
   return function(date){
       date = new Date(date);
       return isToday(date)?filterDate(date, 'HH:mm'):filterDate(date, 'dd.MM HH:mm');
   }
});
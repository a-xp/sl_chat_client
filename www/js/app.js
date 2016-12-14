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
        var rd = angular.extend({}, data, {jsonClass:'Cmd$'+cmdType});
        return stream.send(rd).finally(function(){
            service.processing--;
        });
    }
    var waitingCreation = null;
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
          waitingCreation = toWhom;
          return request('FindOrCreateDlgCmd', {withWhom: toWhom});
        },
        openDlg: function(contact_id){
            service.dialog = null;
            angular.forEach(service.contacts, function(v){
                if(v.dlgId==contact_id)service.dialog = v;
                service.read(contact_id);
            });
        },
        closeDlg: function(){
            service.dialog = null;
        },
        read: function(contact_id){
            return request('ReadCmd', {dlgId:contact_id})
        },
        sendMsg: function(msg){
            if(service.dialog){
                return request('MsgCmd', {dlgId:service.dialog.dlgId, msg:msg})
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
        processing:false,
        error: null
    };

    function setMsgCb() {
        stream.onMessage(function (msg) {
            console.log(msg);
            var data = JSON.parse(msg.data);
            var type = data.jsonClass.replace(/^Result\$/, '');
            switch (type) {
                case 'AuthSuccessResult':
                    service.user = data;
                    service.connected = true;
                    break;
                case 'AuthFailedResult':
                    service.error = data.reason;
                    break;
                case 'GroupsResult':
                    service.groups = data.groups;
                    break;
                case 'ContactsResult':
                    service.contacts = data.contacts;
                    break;
                case 'ContactUpdate':
                    var contact = angular.extend(data.contact, {history:[]});
                    angular.forEach(service.contacts, function (v, k) {
                        if (v.dlgId == contact.dlgId || (!v.dlgId && v.userId==contact.userId)){
                            service.contacts[k] = contact;
                        }
                    });
                    if(waitingCreation && waitingCreation==contact.userId){
                        service.dialog = contact;
                        waitingCreation = null;
                    }
                    if(service.dialog && service.dialog.dlgId==contact.dlgId && contact.hasNew){
                        service.read(contact.dlgId);
                    }
                    break;
                case 'DialogMsgList':
                    if(service.dialog && data.dlgId==service.dialog.dlgId) {
                        service.dialog.history = data.msg;
                    }
                    break;
                case 'DialogNewMsg':
                    if(service.dialog && data.dlgId==service.dialog.dlgId){
                        service.dialog.history = service.dialog.history.concat(data.msg);
                    }
                    break;
                case 'TypingNotification':
                    break;
                default: console.log('unknown msg ', type)
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
    $scope.openDialog = function(dlg){
        $scope.chat.broadcast = null;
        if(dlg.dlgId){
            $scope.cs.openDlg(dlg.dlgId);
        }else{
            $scope.cs.startDlg(dlg.userId);
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
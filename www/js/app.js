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
app.factory('contactsService', function($websocket, serviceUrl, token, $q, $timeout){
    var stream;
    function request(cmdType, data){
        service.processing++;
        var rd = angular.extend({}, data, {jsonClass:'Cmd$'+cmdType});
        return stream.send(rd).finally(function(){
            service.processing--;
        });
    }
    var connDefer = null;
    var waitingCreation = null;
    var service = {
        sentMsg: [],
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
          connDefer = $q.defer();
          return connDefer.promise;
        },
        close: function(){
            stream.close();
            stream = null;
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
                if(v.dlgId==contact_id)service.dialog = angular.extend({history:[]}, v);
                service.read(contact_id);
            });
        },
        closeDlg: function(){
            service.dialog = null;
        },
        read: function(contact_id){
            return request('ReadCmd', {dlgId:contact_id})
        },
        readNew: function(contact_id){
          return request('ReadNewCmd', {dlgId:contact_id})
        },
        sendMsg: function(msg){
            if(service.dialog){
                service.sentMsg.push({text:msg, dlgId:service.dialog.dlgId});
                return request('MsgCmd', {dlgId:service.dialog.dlgId, msg:msg})
            }else{
                return $q.reject("Invalid state");
            }
        },
        broadcastMsg: function(msg, groupId){
            return request('BroadcastCmd', {group:groupId, msg:msg})
        },
        typing: function(){
            if(service.dialog){
                return request('TypingCmd', {dlgId:service.dialog.dlgId})
            }else{
                return $q.reject("Invalid state");
            }
        },
        requestGroups: function(){
          return request('GetGroups')
        },
        requestContacts: function(){
            return request('GetContacts')
        },
        processing:false,
        error: null
    };

    function setMsgCb() {
        stream.onOpen(function(){
            service.connected = true;
        });
        stream.onClose(function(){
            if(!connDefer.promise.$$state.status){
                connDefer.reject(true);
            }
            service.connected = false;
            service.dialog=null;
            service.contacts=null;
            service.groups=null;
            service.sentMsg = [];
        });
        stream.onMessage(function (msg) {
            console.log(msg);
            var data = JSON.parse(msg.data);
            var type = data.jsonClass.replace(/^Result\$/, '');
            switch (type) {
                case 'AuthSuccessResult':
                    service.user = data;
                    service.connected = true;
                    connDefer.resolve(true);
                    service.requestContacts();
                    if(service.user.role=='admin'){
                        service.requestGroups();
                    }
                    break;
                case 'AuthFailedResult':
                    service.error = data.reason;
                    service.close();
                    connDefer.reject(true);
                    break;
                case 'GroupsResult':
                    service.groups = data.groups;
                    break;
                case 'ContactsResult':
                    service.contacts = data.contacts;
                    break;
                case 'DialogMsgAccepted':
                    angular.forEach(service.sentMsg, function(v,k){
                        if(v.dlgId==data.dlgId && javaHashCode(v.text)==data.hash){
                            delete service.sentMsg[k];
                            angular.forEach(service.contacts, function(v,k){
                                if(v.dlgId==v.dlgId)service.contacts[k].last = data.time;
                            });
                            if(service.dialog.dlgId==v.dlgId){
                                service.dialog.history.push({text:v.text, time:data.time, from:service.user.id});
                            }
                        }
                    });
                    break;
                case 'DialogIdResult':
                    var toUser = data.withWhom;
                    var dlgId = data.dlgId;
                    var found = -1;
                    angular.forEach(service.contacts, function (v, k) {
                        if (!v.dlgId && v.userId==toUser){
                            service.contacts[k].dlgId = dlgId;
                            found = k
                        }
                    });
                    if(found>=0) {
                        if (waitingCreation && waitingCreation == toUser) {
                            service.dialog = angular.extend({history:[]}, service.contacts[found]);
                            waitingCreation = null;
                        }
                    }
                    break;
                case 'DialogNewMsg':
                    if(service.dialog && data.dlgId==service.dialog.dlgId) {
                        service.dialog.history = service.dialog.history.concat(data.msg);
                        service.dialog.typing =false;
                    }
                    break;
                case 'DialogMsgList':
                    if(service.dialog && data.dlgId==service.dialog.dlgId) {
                        service.dialog.history = data.msg;
                        service.dialog.typing =false;
                    }
                    break;
                case 'ContactUpdate':
                    var k = contactByDlgId(data.contact.dlgId);
                    if(k>=0){
                        angular.extend(service.contacts[k], data.contact);
                        if(service.dialog && service.dialog.dlgId==data.contact.dlgId && data.contact.hasNew){
                            service.readNew(data.contact.dlgId);
                        }
                    }
                    break;
                case 'TypingNotification':
                    if(service.dialog && data.dlgId==service.dialog.dlgId){
                        service.dialog.typing=true;
                        $timeout(function(){
                            if(service.dialog && data.dlgId==service.dialog.dlgId){
                                service.dialog.typing=false;
                            }
                        }, 5000);
                    }
                    break;
                default: console.log('unknown msg ', type)
            }
        });
    }
    function javaHashCode(str){
        var hash = 0;
        if (str.length == 0) return hash;
        for (i = 0; i < str.length; i++) {
            char = str.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }
    function contactByDlgId(id){
        var found = -1;
        angular.forEach(service.contacts, function (v, k) {
            if(v.dlgId==id)found=k;
        });
        return found;
    }

    return service;
});

app.controller('chatCtrl', function($scope, $filter, contactsService, $timeout, $interval){
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
    $scope.$watch('cs.dialog.history.length', function(len){
        if(len>0){ $timeout(scrollDialog, 50);}
    });
    $scope.$watch('cs.dialog.typing', function(flag){
        if(flag>0){ $timeout(scrollDialog, 50);}
    });
    function scrollDialog(){
        var e = document.getElementById('dialog_messages'); e.scrollTop = e.scrollHeight;
    }
    $scope.$watchCollection('cs.contacts', updateContacts);
    var reconPromise=null;
    $scope.$watch('cs.connected', function(connected){
        if(!connected){
            if(reconPromise)reconPromise.cancel();
            reconPromise = $timeout(function(){
                if(!$scope.cs.connected){
                    $scope.cs.connect()
                }
            },10000);
        }
    });
    $scope.$on("$destroy", function() {
        if(reconPromise){
            reconPromise.cancel(); reconPromise=null
        }
    });
    $scope.toggleWnd = function(){
        $scope.chat.open = !$scope.chat.open;
        if(!$scope.chat.open){
            $scope.cs.closeDlg();
        }
    };
    $scope.tabs = {
        new: [],
        last: [],
        all: [],
        group: $scope.cs.groups
    };
    if($scope.cs.contacts && $scope.cs.contacts.length)updateContacts();
    $scope.openDialog = function(dlg){
        $scope.chat.open = true;
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
    };
    var lastTyping = 0;
    $scope.typing = function () {
        if(lastTyping+5000<Date.now()){
            lastTyping=Date.now();
            $scope.cs.typing()
        }
    };
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
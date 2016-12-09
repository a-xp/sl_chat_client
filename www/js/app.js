/**
 * Created by rkhabibullin on 05.12.2016.
 */
var app = angular.module('chatApp', ['mgcrea.ngStrap', 'ngSanitize', 'ajaxToken', 'ngWebSocket']);
app.constant('serviceUrl', 'ws://localhost:9100/chat');
app.factory('contactsService', function($websocket, serviceUrl, token, $q){
    var stream = $websocket(serviceUrl);
    function request(cmdType, data){
        service.processing++;
        var rd = angular.extend({}, data, {jsonClass:'ChatService$'+cmdType});
        return stream.send(rd).finally(function(){
            service.processing--;
        });
    }
    var service = {
        connected: true,
        contacts: null,
        groups: null,
        dialog: null,
        user: null,
        token: function(token){
            return request('TokenCmd', {token:token})
        },
        open: function(contact_id){
            return request('OpenDlgCmd', {contact:contact_id})
        },
        close: function(){
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
    service.token(token());
    service.groups = [
        {id:1, login:'Линия СКС'},
        {id:2, login:'Супервайзеры'},
        {id:3, login:'Операторы КЦ'}
    ];

    service.contacts = [
        {id:1, login:'vbychkov', new:true, last:'2016-12-01 11:00:11'},
        {id:2, login:'rydenko', new:false, last:'2016-12-01 10:00:11'},
        {id:3, login:'sirenina', new:false, last:'2016-12-01 06:00:11'},
        {id:4, login:'nikolashkina', new:false, last:'2016-11-11 11:00:11'},
        {id:5, login:'mednikova', new:false, last:'2016-11-01 11:00:11'},
        {id:7, login:'pavlikova', new:true, last:'2016-22-01 11:00:11'}
    ];

    service.user = {
        roleName: 'Супервайзер',
        role: 'admin'
    };

    stream.onMessage(function(msg){
        console.log(msg);
        var data = JSON.parse(msg.data);
        switch(data.type){
            case 'info':
                service.user = data.user;
                connected=true;
                break;
            case 'groups':
                service.groups = data.groups; break;
            case 'contacts':
                service.contacts = data.contacts; break;
            case 'dialog':
                service.dialog = data.dialog;
                break;
            case 'contact':
                var i = -1;
                angular.forEach(service.contacts, function(v, k){
                    if(v.id==data.id)i = k;
                });
                if(i>=0){
                    service.contacts[k] = data.contact;
                }else{
                    service.contacts.push(data.contact);
                }
                if(dialog.id==data.id){service.read(data.id)}
                break;
            case 'msg':
                if(service.dialog && data.contact_id==service.dialog.id){
                    angular.extend(service.dialog.msg, data.msg);
                }
                break;
        }
    });

    return service;
});

app.controller('chatCtrl', function($scope, $filter, contactsService){
    function updateContacts(){
        $scope.tabs.last = $filter('orderBy')($scope.cs.contacts, ['-new', '-when']).slice(0, 5);
        $scope.tabs.all = $filter('orderBy')($scope.cs.contacts, 'login');
        $scope.tabs.new = $filter('filter')($scope.cs.contacts, {new:true}, true);
    }
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
    if($scope.cs.contacts.length)updateContacts();
    $scope.openDialog = function(dialog){
        $scope.chat.broadcast = null;
        $scope.cs.open(dialog.id);
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
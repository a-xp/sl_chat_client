/**
 * Created by rkhabibullin on 05.12.2016.
 */
var app = angular.module('chatApp', ['mgcrea.ngStrap', 'ngSanitize', 'ajaxToken', 'ngWebSocket']);
app.constant('serviceUrl', 'ws://localhost:9100/chat');
app.factory('contactsService', function($websocket, serviceUrl, token){
    /*var stream = $websocket(serviceUrl);
    stream.send({token:token()});*/

    var service = {
        connected: false,
        contacts: null,
        groups: null,
        dialog: null,
        user: null,
        open: function(contact_id){
            /*service.processing++;
            return stream.send({open:contact_id}).finally(function(){
                service.processing--;
            });*/
            service.dialog = {
                login: 'vbychkov',
                io: 'Вадим Бычков',
                history: [
                    {text:'Привет!', my:false, when: '2016-12-04 12:34:01'},
                    {text:'Привет!', my:true, when: '2016-12-05 13:34:01'},
                    {text:'Обязательные требования к функционалу', my:false, when: '2016-12-05 13:35:01'},
                    {text:'OK', my:true, when: '2016-12-06 12:36:01'}
                ]
            };
        },
        read: function(contact_id){
            service.processing++;
            return stream.send({read:contact_id}).finally(function(){
               service.processing--;
            });
        },
        sendMsg: function(msg){
            if(service.dialog){
                service.processing++;
                return stream.send({to:service.dialog.id, msg:msg}).finally(function(){
                    service.processing--;
                });
            }else{
                return $q.reject("Invalid state");
            }
        },
        processing:false
    };

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

    stream.onMessage(function(msg){
        var data = JSON.parse(msg);
        switch(data.type){
            case 'info':
                service.user = data.user;
                service.connected = true;
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
    $scope.chat ={
        rdy:true,
        open: true,
        newMsg: [],
        contactTab: 'last'
    };
    $scope.cs = contactsService;
    $scope.$on('contacts-updated', updateContacts);

    function updateContacts(){
        
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
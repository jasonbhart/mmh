;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    app.controller('UserAccountController', ['$scope', '$log', 'sessionService', 'dialogs', 'notificationService', '$sce', '$window','util', 'userService',
    function($scope, $log, sessionService, dialogs, notificationService, $sce, $window, util, userService) {
        $scope.isAuthenticated = false;
        $scope.user = null;
        $scope.countNotification = '';
        $scope.notifications = [];
        $scope.registrationId = '';

        $scope.login = function() { 
            dialogs.auth();
        }

        $scope.logout = function() {
            sessionService.logout();
        }
        
        if ($window.$.cookie('user')) {
            try {
                var user = JSON.parse($window.$.cookie('user'));
                user.getProfileImageURL = function (){
                    return user.profileImageURL;
                };
                $scope.user = user;
                $scope.isAuthenticated = (user.provider !== 'anonymous');
                
            } catch (e) {
                console.log(e);
            }
        }
        
        $scope.$on('auth.changed', function(evt, user) {
            $scope.user = user;
            $scope.isAuthenticated = !user.isAnonymous();
            
            notificationService.trackNotification(user.id);
            
            if ($scope.registrationId) {
                userService.get(user.id).then(function(userObj) {
                    userObj.saveRegistrationId($scope.registrationId);
                });
            }
        });
        
        $scope.$watch('countNotification', function (newValue, oldValue) {
            if ($scope.user) {
                notificationService.getLastNotifications($scope.user.id).then(function(notifications) {
                    $scope.notifications = notifications.reverse();
                });
            }
        });
        
        $scope.$on('notification.changed', function (evt, data) {
            if ($scope.user && $scope.user.id == data.userId) {
                $scope.countNotification = data.count; 
            }
        });
                
        $scope.getNotificationText = function(notification) {
            if (!notification) {
                return '';
            }
            
            var text = '';
            
            if (notification.type === 'time') {
                text = 'New time <b>' + moment(notification.value).format('h:mmA') + '</b> added to <b> ' + notification.meetName + '</b>';
            } else if (notification.type === 'place') {
                text = 'New place <b>' + notification.value + '</b> added to <b> ' + notification.meetName + '</b>';
            } else if (notification.type === 'group') {
                if (notification.time && notification.place) {
                    text = 'New group <b>' +  notification.place + ' @ ' + moment(notification.time).format('h:mmA') + '</b> added to <b> ' + notification.meetName + '</b>';
                } else {
                    text = 'New group <b>' + notification.value + '</b> added to <b> ' + notification.meetName + '</b>';
                }
            } else if (notification.type === 'user') {
                text = 'New user <b>' + notification.value + '</b> joined activity <b> ' + notification.meetName + '</b>';
            } else if (notification.type === 'rsvp') {
                text = 'User <b>' + notification.value + '</b> joined activity <b> ' 
                        + notification.meetName + '('
                        + notification.place 
                        + ' @ ' 
                        + moment(notification.time).format('h:mmA') + ')</b>';
            } else if (notification.type === 'comment') {
                text = getCommentedUser(notification.users) + ' commented on an activity you are participating';
            }
            return $sce.trustAsHtml(text);
        }
        
        var getCommentedUser = function(users) {
            var result = '';
            if (users.length <= 2) {
                return '<b>' + users[0].name + '</b>';
            } else if (users.length === 3) {
                for (var i in users) {
                    if (users[i].id !== $scope.user.id) {
                        if (result === '') {
                            result = '<b>' + users[i].name + '</b>';
                        } else {
                            result += ' and <b>' + users[i].name + '</b>';
                        }
                    }
                }
                return result;
            } else {
                return '<b>' + users[0].name + '</b>' + ' and <b>' + (users.length - 2) + ' others</b>';
            }
        }
        
        $scope.clearNotification = function (key, notificationId) {
            if ($scope.user && $scope.user.id) {
                notificationService.removeNotification($scope.user.id, notificationId);
                $scope.notifications.splice(key,1);
                if ($scope.notifications.length === 0) {
                    setTimeout(function() {
                        $window.$('#notifications-info').hide();
                    }, 100);
                }
                util.addEventToDataLayer('Notifications', 'Clear', null, notificationId);
            }
        };
        
        $scope.clearAllNotification = function () {
            if ($scope.user && $scope.user.id) {
                notificationService.removeAllNotification($scope.user.id);
                $scope.notifications = [];
                setTimeout(function() {
                    $window.$('#notifications-info').hide();
                }, 100);
                
                util.addEventToDataLayer('Notifications', 'Clear', null, 'All');
            }
        };
        
        $('.notifications').click(function(e) {
            var left = 320;
            var currentLeftPosition = $('.notifications').offset().left;
            if (currentLeftPosition < left - 35) {
                left = currentLeftPosition + 35;
                $(this).find('.icon.arow').css({right: (340-left) + 'px'});
            } else {
                $(this).find('.icon.arow').css({right: '20px'});
            }
            $('#notifications-info').css({
                width: '0px',
                position: 'absolute',
                top: '0px',
                left: '-' + left + 'px',
                opacity: 1,
                display: 'block'
            });
            
            if ($scope.user) {
                notificationService.resetNotifications($scope.user.id);
            }
            
            e.stopPropagation();
        });
        $('.notifications .dropdown-button .notification-icon').click(function() {
            if ($('#notifications-info').is(':visible')) {
                $('#notifications-info').hide();
                return false;
            }
        });
        $('body').click(function() {
            $('#notifications-info').hide();
        });
        
        var sendMessage = function (message) {
            return new Promise(function (resolve, reject) {
                var messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = function (event) {
                    if (event.data.error) {
                        reject(event.data.error);
                    } else {
                        resolve(event.data);
                    }
                };
                if (navigator.serviceWorker && navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage) {
                    navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
                }
            });
        }
        
        $(document).ready(function() {
            if (ChromePushManager) {
                var chromePushManager = new ChromePushManager('service-worker.js', function (error, registrationId) {
                    console.log(registrationId);
                    $scope.registrationId = registrationId;
                    sendMessage({action: 'send guid', guid: $.cookie('guid')});
                }); 
                setTimeout(function() {
                    //navigator.serviceWorker.controller.postMessage({'hello': 'world'})
                }, 1000);
                
            }
            
        });
    }]);
})();

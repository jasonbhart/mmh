;(function () {
    "use strict";
    var app = angular.module('mmh.controllers');
    app.controller('CleanController', ['$scope', 'appConfig',
        function($scope, appConfig) {
            $scope.table = 'meeting';
            $scope.days = 7;
            
            var ref = new Firebase(appConfig.firebaseUrl);
            
            $scope.clean = function() {
                alert('Forbidden');return;
                if ($scope.table === 'meeting') {
                    var meetingRef = ref.child('meets');
                    meetingRef.on('child_added', function (snapshot) {
                        var key = snapshot.key();
                        var created = snapshot.val().createdDate;
                        var diff = moment().diff(moment(created));
                        var dayDiff = diff / 1000 / 3600 / 24;
                        if (dayDiff > parseInt($scope.days)) {
                            meetingRef.child(key).remove();
                            console.log('Removing meeting id: ', key);
                        }
                    });
                } else if ($scope.table === 'notification') {
                    var notificationRef = ref.child('notifications');
                    notificationRef.on('child_added', function (snapshot) {
                        var key = snapshot.key();
                        var userRef = notificationRef.child(key);
                        userRef.on('child_added', function (snapshot2) {
                            var key2 = snapshot2.key();
                            var created = snapshot2.val().createdAt;
                            var diff = moment().diff(moment(created));
                            var dayDiff = diff / 1000 / 3600 / 24;
                            console.log(dayDiff);
                            if (dayDiff > parseInt($scope.days)) {
                                userRef.child(key2).remove();
                                console.log('Removing notification id: ', key2);
                            }
                        });
                        
                        
                    });
                }
            };
        }]);
})();
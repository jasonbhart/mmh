;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    // Location map popup controller
    app.controller(
        'UserMeetingTimesController',
        ['$scope', 'modalInstance', 'timesProvider', function ($scope, modalInstance, timesProvider) {

            $scope.timeFormat = 'h:mma';
            $scope.time = moment().millisecond(0);
            $scope.times = timesProvider.getTimes();
            console.log($scope.times);

            $scope.addTime = function() {
                var time = $scope.time;
                var foundTime = _.find($scope.times, function(t) {
                    return t.isSame(time);
                });
                
                if (!foundTime)
                    $scope.times.push(time);
            }
            
            $scope.removeTime = function(time) {
                _.remove($scope.times, function(t) {
                    return t.isSame(time);
                });               
            }

            $scope.formatTime = function(time) {
                return timesProvider.format(time);
            }

            $scope.confirm = function() {
                modalInstance.close($scope.times);
            }

            $scope.cancel = function() {
                modalInstance.dismiss();
            }
        }
    ]);
})();

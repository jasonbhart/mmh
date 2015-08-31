;(function () {
    "use strict";
    var app = angular.module('mmh.controllers');
    app.controller('CreateMeetingController', ['$scope', 'dataProvider', 'meetingService', 
        function($scope, dataProvider, meetingService) {
        $scope.MAX_STAGE = 5;
        $scope.stage = 1; 
        $scope.what = 'restaurants';
        $scope.when = 1;
        $scope.where = 1;
        $scope.establishment = 1;
        $scope.invite = 1;
        $scope.publish = 1;
        $scope.terms = dataProvider.getTerms();
        $scope.term = 'restaurants';
        
        $scope.next = function() {
            // test create meeting, will move to finish later
            //($scope.stage != 1) || createMeeting();
            $scope.stage ++;
        }
        
        $scope.back = function() {
            if ($scope.stage > 1) {
                $scope.stage --;
            }  
        }
        
        $scope.finish = function() {
            alert('finish');
        }
        
        $scope.getVisitedStatus = function (elementIndex) {
            if (elementIndex < $scope.stage) {
                return 'visited';
            } else if (elementIndex == $scope.stage) {
                return 'active';
            } else if (elementIndex == $scope.stage + 1) {
                return 'next';
            } else {
                return '';
            }
        };
        
        var createMeeting = function() {
            var data = {
                name: $scope.meeting_name,
                createdDate: moment().utc().toISOString()
            };
            var meetingPromise = meetingService.create(data);
            meetingPromise.then(function(meeting) {
                var meetingId = meeting.refs.current.key();
                console.log(meetingId);
            });
        };
    }]);
})();
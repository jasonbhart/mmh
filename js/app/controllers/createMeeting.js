;(function () {
    "use strict";
    var app = angular.module('mmh.controllers');
    app.controller('CreateMeetingController', ['$scope', 'dataProvider', function($scope, dataProvider) {
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
        }
    }]);
})();
;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    // Location map popup controller
    app.controller(
        'UserMeetingPlacesController',
        ['$scope', 'modalInstance', 'placesProvider', function ($scope, modalInstance, placesProvider) {

        $scope.terms = placesProvider.getTerms();
        $scope.term = placesProvider.getCategory() || ($scope.terms.length > 0 ? $scope.terms[0].id : null);
        $scope.places = [];

        $scope.$watch('term', function(value) {
            placesProvider.getPlaces(value).then(function(places) {
                $scope.places = places;
            });
        });
        
        $scope.$watchCollection('terms', function() {
            // todo: move to separate directive
            $scope.$evalAsync(function() {
                $('.select-jq').selectBox({
                    mobile: true
                });
            });
        });
        
        $scope.confirm = function() {
            var places = angular.copy(_.filter($scope.places, 'selected'));
            modalInstance.close(places);
        }
        
        $scope.cancel = function() {
            modalInstance.dismiss();
        }
    }]);
})();

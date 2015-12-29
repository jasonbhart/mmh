;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    // Location map popup controller
    app.controller(
        'UserMeetingPlacesController',
        ['$scope', 'modalInstance', 'placesProvider', 'dataProvider', 'util', '$window', function ($scope, modalInstance, placesProvider, dataProvider, util, $window) {

        $scope.terms = placesProvider.getTerms();
        $scope.term = placesProvider.getCategory() || ($scope.terms.length > 0 ? $scope.terms[0].id : null);
        $scope.places = [];
        $scope.business_name = '';
        $scope.searchSuggestion = null;
        $scope.sort = 'highest_rate';
        $scope.distance_unit = placesProvider.getDistanceUnit();

        $window.$('#business_name').keyup(function(){
            clearTimeout($scope.searchSuggestion);
            if ($window.$('#business_name').val) {
               $scope.searchSuggestion = setTimeout($scope.showPlaceSuggestion, 500);
            }
        });
            
        $scope.selectBusiness = function(index) {
            $window.$('#filled-in-box-' + index).click();
        };
            
        $scope.showPlaceSuggestion = function() {
            var options = placesProvider.getMeetingOptions();
            
            var arr = $scope.business_name.split(',');
            if (arr[0] && arr[1]) {
                options.term = arr[0];
                options.location = $scope.business_name.replace(arr[0] + ',', '').trim('');
                options.radius = null;
            } else {
                options.term = $scope.business_name;
                options.location = null;
            }
            
            options.sort = $scope.sort;

            $window.$('.loading-wrap').show();
            dataProvider.getSuggestions(options).then(function(suggestions) {
                $scope.places = suggestions;
                $window.$('.loading-wrap').hide();
            });
        };

        $scope.$watch('term', function(value) {
            $window.$('.loading-wrap').show();
            placesProvider.getPlaces(value, $scope.sort).then(function(places) {
                $scope.places = places;
                $window.$('.loading-wrap').hide();
            });
        });
        
        $scope.$watch('sort', function(value) {
            $window.$('.loading-wrap').show();
            placesProvider.getPlaces($scope.term, value).then(function(places) {
                $scope.places = places;
                $window.$('.loading-wrap').hide();
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
        
        $scope.changeCategory = function () {
            util.addEventToDataLayer('Activity', 'Venue', 'Change Category', $scope.term);
        }
        
        $scope.convertMetersToFeet = function (meters) {
            return util.convertMetersToFeet(meters);
        }
        
        $scope.confirm = function() {
            var places = angular.copy(_.filter($scope.places, 'selected'));
            modalInstance.close(places);
        }
        
        $scope.cancel = function() {
            modalInstance.dismiss();
        }
    }]);
})();

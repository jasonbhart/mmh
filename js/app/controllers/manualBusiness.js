;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    // Location map popup controller
    app.controller(
        'ManualBusinessController',
        ['$scope', 'modalInstance', 'dataProvider', 'options', '$window', function ($scope, modalInstance, dataProvider, options, $window) {
            $scope.business_name = '';
            $scope.business = {};
            $scope.places = [];
            $scope.searchSuggestion = null;
            $scope.sort = options.sort || 'highest_rate';
            
            $scope.term = options.term || '';
            $scope.category_filter = options.category_filter || '';
            
            $window.$('#business_name').keyup(function(){
                clearTimeout($scope.searchSuggestion);
                if ($window.$('#business_name').val) {
                   $scope.searchSuggestion = setTimeout($scope.showPlaceSuggestion, 500);
                }
            });

            $scope.selectBusiness = function(index) {
                $window.$('#rating_image_' + index).click();
            };
            
            $scope.$watch('sort', function(value) {
                $scope.showPlaceSuggestion();
            });
            
            $scope.showPlaceSuggestion = function() {
                var arr = $scope.business_name.split(',');
                if (arr[0] && arr[1]) {
                    options.term = arr[0];
                    options.location = $scope.business_name.replace(arr[0] + ',', '').trim('');
                    options.radius = null;
                } else {
                    options.term = $scope.business_name;
                    options.location = null;
                }
                
                if (!options.term) {
                    options.term = $scope.term;
                }
                
                if ($scope.category_filter) {
                    options.category_filter = $scope.category_filter;
                }
                
                options.sort = $scope.sort;
                
                options.limit = 5;
                $window.$('.loading-wrap').show();
                dataProvider.getSuggestions(options).then(function(suggestions) {
                    $scope.places = suggestions;
                    $window.$('.loading-wrap').hide();
                });
            };
            
            $scope.showPlaceSuggestion();
            
            $scope.confirm = function() {
                modalInstance.close($scope.business);
            }

            $scope.cancel = function() {
                modalInstance.dismiss();
            }
        }
    ]);
})();

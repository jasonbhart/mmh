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
            
            $window.$('#business_name').keyup(function(){
                clearTimeout($scope.searchSuggestion);
                if ($window.$('#business_name').val) {
                   $scope.searchSuggestion = setTimeout($scope.showPlaceSuggestion, 500);
                }
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
                
                options.limit = 5;
                dataProvider.getSuggestions(options).then(function(suggestions) {
                    $scope.places = suggestions;
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

;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    // get data from yelp
    app.controller('HomepageCtrl', ['$scope', 'dataProvider', function ($scope, dataProvider) {
        dataProvider.getSuggestions().then(function(suggestions) {
             $scope.yelps = suggestions;
        });
        
        $scope.showmore = function() {
            
        };
    }]);
})();

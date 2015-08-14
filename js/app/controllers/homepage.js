;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    // get data from yelp
    app.controller('HomepageCtrl', ['$scope', 'dataProvider', function ($scope, dataProvider) {
        var ITEM_PER_PAGE = 5;
        var offset = 0;
        dataProvider.getSuggestions({offset:offset,limit:ITEM_PER_PAGE}).then(function(suggestions) {
             $scope.yelps = suggestions;
             offset += ITEM_PER_PAGE;
        });
        
        $scope.showmore = function() {
            dataProvider.getSuggestions({offset:offset,limit:ITEM_PER_PAGE}).then(function(suggestions) {
                $scope.yelps = $scope.yelps.concat(suggestions);
                offset += ITEM_PER_PAGE;
            });
        };
    }]);
})();

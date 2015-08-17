;(function () {
    "use strict";

    var app = angular.module('mmh.directives');
    
    app.directive('starsRating', function() {
        return {
            restrict: 'E',
            scope: {
                rating: '@'
            },
            template: '<p class="rate"></p>',
            link: function(scope, element, attrs) {
                var maxStars = 5;
                var rating = scope.rating % maxStars;
                if (isNaN(rating))
                    return;
                
                var stars = parseInt(rating);
                var halfStars = Math.ceil((rating - stars).toFixed(2));
                var emptyStars = Math.floor(maxStars - stars - halfStars);
                var result = '<i class="material-icons">&#xE838;</i>'.repeat(stars)
                    + '<i class="material-icons">&#xE839;</i>'.repeat(halfStars)
                    + '<i class="material-icons">&#xE83A;</i>'.repeat(emptyStars);
            
                element.find('.rate').append(result);
            }
        }
    });
})();

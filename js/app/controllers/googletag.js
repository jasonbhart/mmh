;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    // get data from yelp
    app.controller('GoogleTagCtr', ['$scope', '$sce', function ($scope, $sce) {
        var tag = '<!-- Google Tag Manager -->' + 
                        '<noscript><iframe src="//www.googletagmanager.com/ns.html?id=GTM-M7LT4V"' +
                        'height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>' +
                        '<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({\'gtm.start\':' + 
                        'new Date().getTime(),event:\'gtm.js\'});var f=d.getElementsByTagName(s)[0],' +
                        'j=d.createElement(s),dl=l!=\'dataLayer\'?\'&l=\'+l:\'\';j.async=true;j.src=' + 
                        '"//www.googletagmanager.com/gtm.js?id="+i+dl;f.parentNode.insertBefore(j,f);' +
                        '})(window,document,\'script\',\'dataLayer\',\'GTM-M7LT4V\');</script>' + 
                        '<!-- End Google Tag Manager -->';
        $scope.getTag = function() {
            return $sce.trustAsHtml(tag);
        }        
        
    }]);
})();

;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    // get data from yelp
    app.controller('Snippet', ['$scope', '$sce', function ($scope, $sce) {
            
        // google tag for managin tags
        var googleTag = '<!-- Google Tag Manager -->' + 
                        '<noscript><iframe src="//www.googletagmanager.com/ns.html?id=GTM-M7LT4V"' +
                        'height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>' +
                        '<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({\'gtm.start\':' + 
                        'new Date().getTime(),event:\'gtm.js\'});var f=d.getElementsByTagName(s)[0],' +
                        'j=d.createElement(s),dl=l!=\'dataLayer\'?\'&l=\'+l:\'\';j.async=true;j.src=' + 
                        '"//www.googletagmanager.com/gtm.js?id="+i+dl;f.parentNode.insertBefore(j,f);' +
                        '})(window,document,\'script\',\'dataLayer\',\'GTM-M7LT4V\');</script>' + 
                        '<!-- End Google Tag Manager -->';
        $scope.getGoogleTag = function() {
            return $sce.trustAsHtml(googleTag);
        };      
        
        // facebook sdk for share on facebook function
        var facebookSDK =   '<div id="fb-root"></div>' + 
                            '<script>(function(d, s, id) {' +
                                'setTimeout(function(){' + 
                                    'var js, fjs = d.getElementsByTagName(s)[0];' +
                                    'if (d.getElementById(id)) return;' +
                                    'js = d.createElement(s); js.id = id;' +
                                    'js.src = "//connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.4";'+
                                    'fjs.parentNode.insertBefore(js, fjs);'+
                                '}, 3000);' +
                            '}(document, \'script\', \'facebook-jssdk\'));</script>';
        
        $scope.getFacebookSDK = function() {
            console.log('yyy');
            return $sce.trustAsHtml(facebookSDK);
        };
        
        // twitter sdk for sharing on twitter
        var twitterSDK =    '<script>(function(d,s,id){ ' + 
                                'setTimeout(function(){' +
                                    'var js,fjs=d.getElementsByTagName(s)[0],' + 
                                    'p=/^http:/.test(d.location)?\'http\':\'https\'; '+ 
                                    'if(!d.getElementById(id)){' + 
                                        'js=d.createElement(s);js.id=id;js.src=p+\'://platform.twitter.com/widgets.js\';'+
                                        'fjs.parentNode.insertBefore(js,fjs);'+
                                    '}' +
                                '}, 3000);' +
                            '}(document, \'script\', \'twitter-wjs\'));</script>';
        
        $scope.getTwitterSDK = function() {
            console.log('xxx');
            console.log($scope.getSharingUrl)
            return $sce.trustAsHtml(twitterSDK);
        };
    }]);
})();

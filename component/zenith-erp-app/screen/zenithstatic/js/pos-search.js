(function() {
    function initPosSearch() {
        var sf = document.querySelector('.pos-search-bar form');
        if (!sf) { setTimeout(initPosSearch, 300); return; }
        var si = sf.querySelector('input[name=searchTerm]');
        if (!si) { setTimeout(initPosSearch, 300); return; }
        var timer;
        function doSearch() {
            var term = si.value.trim();
            var url = new URL(window.location.href);
            if (term) { url.searchParams.set('searchTerm', term); }
            else { url.searchParams.delete('searchTerm'); }
            window.location.href = url.toString();
        }
        sf.addEventListener('submit', function(e) {
            e.preventDefault();
            clearTimeout(timer);
            doSearch();
        });
        si.addEventListener('input', function() {
            clearTimeout(timer);
            timer = setTimeout(doSearch, 800);
        });
    }
    initPosSearch();
})();

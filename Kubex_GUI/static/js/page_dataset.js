(function($) {
	const substringMatcher = function(strs) {
		  return function findMatches(q, cb) {
		    var matches, substringRegex;

		    // an array that will be populated with substring matches
		    matches = [];

		    // regex used to determine if a string contains the substring `q`
		    substrRegex = new RegExp(q, 'i');

		    // iterate through the pool of strings and for any string that
		    // contains the substring `q`, add it to the `matches` array
		    $.each(strs, function(i, str) {
		      if (substrRegex.test(str)) {
		        matches.push(str);
		      }
		    });

		    cb(matches);
		 };
	};

	const keywords = $('#keywordInfo span').map(function() { return $(this).text() }).get(); // get values of keywords from djangp rendered template: base.html

    // keywords input 
    $('#keywords-input').tagsinput({
      typeaheadjs: {
        name: 'states',
        source: substringMatcher(keywords)
      }
    });

    $('#keywords-input').on('itemAdded', function (event) {
        $('#keywords-input').value = $("#keywords-input").tagsinput('items');
    }); 

    // search bar

    $('#dataset-searchBar').tagsinput({
      typeaheadjs: {
        source: substringMatcher(keywords)
      }
    });

    $('#dataset-searchBar').on('itemAdded itemRemoved', function (event) {
        $('#dataset-searchBar').value = $("#dataset-searchBar").tagsinput('items');
        $('#dataset-search-input-container .bootstrap-tagsinput .twitter-typeahead .tt-input').attr('placeholder', $("#dataset-searchBar").tagsinput('items').length || $('#dataset-search-input-container .bootstrap-tagsinput .twitter-typeahead .tt-input').val() ? '': 'Trouver un jeux de données...');
    }); 

    const searchBar = $('#dataset-searchBar').get(0);

	const handleSearch = () => {
		const filter = $('#searchBar-filter').val();
		if (!filter) {
			alert('Please select at least ONE field to filter your input... ');
			return false;
		}
		let keywordInput = $('input#dataset-searchBar').val();
		let normalInput = $('#dataset-search-input-container .bootstrap-tagsinput .twitter-typeahead .tt-input').val();
		let content;
		if (keywordInput && normalInput) {
			content = keywordInput.split(',');
			content.push(normalInput);
		} else if(!(keywordInput || normalInput)) {
			content = null;
		} else {
			content = keywordInput ? keywordInput : normalInput;
		}

		if (content === null) {
			$('#dataset-container').children('div.panel').css({display: 'block'});
		} else {
			const url = `/api/dataset/search?content=${content}&filter=${filter}`;
			try {
				$.get(url, (response) => {
					const datasetIds = response.datasets;
					const panels = $('#dataset-container').children('div.panel').get();
					panels.forEach((panel) => {
						const id = parseInt($(panel).attr('id').split('_')[1]);
						if (!Number.isNaN(id)) {
							if (datasetIds.indexOf(id) !== -1 ) {
								$(panel).css({display: 'block'});
							} else {
								$(panel).css({display: 'none'});
							}
						}
					});
					responseMsg('#alert_container', {status: 200});
				});
			} catch(err) {
				responseMsg('#alert_container', err);
			}
		}
	}

	const handleSort = (event) => {
		if (event.target.tagName !== 'BUTTON') { return false;} // avoid trigger by <i>
		const targetBtn = event.target;
		const sortKey = $(targetBtn).attr('data-sortKey');
		const state = $(targetBtn).attr('data-state');

		// deal with css of sort btn group 
		$(targetBtn).removeClass(); // clean classes
		$(targetBtn).siblings().removeClass();
		$(targetBtn).addClass('btn');
		$(targetBtn).siblings().addClass('btn');
		$(targetBtn).addClass(state === 'active-descend' ? 'btn-success' : 'btn-info');
		$(targetBtn).attr('data-state', state === 'active-descend' ? 'active-ascend' : 'active-descend');
		$(targetBtn).children('i').removeClass();
		$(targetBtn).children('i').addClass(state === 'active-descend' ? 'fa fa-angle-up': 'fa fa-angle-down');
		$(targetBtn).siblings().attr('data-state', 'deactivate');
		$(targetBtn).siblings().children('i').removeClass();
		$(targetBtn).siblings().children('i').addClass('fa fa-angle-down');

		const panels = $('#dataset-container').children('div.panel').get();

		switch (sortKey) {
			case 'title':
				panels.sort((a, b) => 
					$(targetBtn).attr('data-state') === 'active-descend' ? $(a).find("span[name='title']").text() < $(b).find("span[name='title']").text(): $(a).find("span[name='title']").text() > $(b).find("span[name='title']").text()
				); // judge sorting order by newly set state
				
				break;
			case 'date':
				panels.sort((a, b) => 
					$(targetBtn).attr('data-state') === 'active-descend' ? $(a).find("span[name='date']").attr('data-value') < $(b).find("span[name='date']").attr('data-value') : 
					$(a).find("span[name='date']").attr('data-value') > $(b).find("span[name='date']").attr('data-value')
				);
				break;
			case 'kube':
				panels.sort((a, b) => 
					$(targetBtn).attr('data-state') === 'active-descend' ? $(a).find("span[name='kube']").text() < $(b).find("span[name='kube']").text() : 
					$(a).find("span[name='kube']").text() > $(b).find("span[name='kube']").text()
				);
				break;
			case 'size':
				panels.sort((a, b) => 
					$(targetBtn).attr('data-state') === 'active-descend' ? parseInt($(a).find("span[name='size']").text()) < parseInt($(b).find("span[name='kube']").text()) : 
					parseInt($(a).find("span[name='kube']").text()) > parseInt($(b).find("span[name='kube']").text())
				);
				break;
			default:
				break; 
		}

		$('div#dataset-container').html(null);
		panels.forEach((panel) => {
			$('div#dataset-container').append(panel);
		});

	}

	$('button#dataset-search-btn').get(0).addEventListener('click', handleSearch);

	$('select#searchBar-filter').multiselect({allSelectedText: 'Tous les champs'});
	$('select#searchBar-filter').multiselect('selectAll', false);
	$('select#searchBar-filter').multiselect('updateButtonText');

	$('div#sort-btn-container button').get().forEach((btn) => {
		btn.addEventListener('click', handleSort);
	});

})(jQuery);

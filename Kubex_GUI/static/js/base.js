//Todo
const substringMatcher = function(strs) {
		  return function findMatches(q, cb) {
		    var matches, substrRegex;

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

const keywords = $('#keywordInfo span').map(function() { return $(this).text() }).get(); // get values of keywords from djangp rendered template

$('#editDatasetModal input#dataset-keyword').tagsinput({ // for edit keywords in modal
      typeaheadjs: {
        name: 'keywords',
        source: substringMatcher(keywords)
      }
});

(function($) {
	// const substringMatcher = function(strs) {
	// 	  return function findMatches(q, cb) {
	// 	    var matches, substrRegex;

	// 	    // an array that will be populated with substring matches
	// 	    matches = [];

	// 	    // regex used to determine if a string contains the substring `q`
	// 	    substrRegex = new RegExp(q, 'i');

	// 	    // iterate through the pool of strings and for any string that
	// 	    // contains the substring `q`, add it to the `matches` array
	// 	    $.each(strs, function(i, str) {
	// 	      if (substrRegex.test(str)) {
	// 	        matches.push(str);
	// 	      }
	// 	    });

	// 	    cb(matches);
	// 	 };
	// };

	// const keywords = $('#keywordInfo span').map(function() { return $(this).text() }).get(); // get values of keywords from djangp rendered template

	$('input#search-input').tagsinput({
      typeaheadjs: {
        name: 'states',
        source: substringMatcher(keywords)
      }
    });

    // $('input#search-input').on('itemAdded itemRemoved', function (event) {
    //     $('input#search-input').val($("#search-input").tagsinput('items'));
    //     $('#search-input-container .bootstrap-tagsinput .twitter-typeahead .tt-input').attr('placeholder', $("#search-input").tagsinput('items').length || $('#search-input-container .bootstrap-tagsinput .twitter-typeahead .tt-input').val() ? '': 'Recherche Globale...');
    // }); 

	const handleSearch = () => {
		let keywordInput = $('input#search-input').val();
		let normalInput = $('#search-input-container .bootstrap-tagsinput .twitter-typeahead .tt-input').val();
		let content;
		if (keywordInput && normalInput) {
			content = keywordInput.split(',');
			content.push(normalInput);
		} else if(!(keywordInput || normalInput)) {
			content = null;
		} else {
			content = keywordInput ? keywordInput : normalInput;
		}

		window.location = `/search?content=${content}`;
	}

	$('button#search-btn').get(0).addEventListener('click', handleSearch);
})(jQuery);

// Grobal functions 
const responseMsg = (ele, response) => {
		if (!response) {
			console.log('No response to handle...');
			return false;
		}

		console.log(888, response);

		let msg;

		let alertBlock = null;

		const MSG_200_OK = response.message || "Your request has been successfully submit";

		const MSG_500_INTERNAL_SERVER_ERROR = response.message || "Oops! There is something wrong in the server, plz try again";

		const MSG_400_BAD_REQUEST = response.message || "Oops! There is something wrong with your request, plz try again";

		switch (response.status) {
			case 200 || 201 || 'success':
				msg = MSG_200_OK;
				alertBlock = $.parseHTML(`<div class="alert alert-success alert-dismissible" role="alert">\
						<button type="button" class="close" data-dismiss="alert" aria-label="Close">\
						<span aria-hidden="true">&times;</span>\
						</button>${msg}</div>`)[0];
				break;
			case 400 || 403: 
				msg = response.body&&response.body.Error ? `${MSG_400_BAD_REQUEST} ${response.body.Error}`: MSG_400_BAD_REQUEST;
				alertBlock = $.parseHTML(`<div class="alert alert-danger alert-dismissible" role="alert">\
					<button type="button" class="close" data-dismiss="alert" aria-label="Close">\
					<span aria-hidden="true">&times;</span>\
					</button>${msg}</div>`)[0];
				break;
			case 500:
				msg = response.body&&response.body.Error ? `${MSG_500_INTERNAL_SERVER_ERROR} ${response.body.Error}`: MSG_500_INTERNAL_SERVER_ERROR;
				alertBlock = $.parseHTML(`<div class="alert alert-danger alert-dismissible" role="alert">\
					<button type="button" class="close" data-dismiss="alert" aria-label="Close">\
					<span aria-hidden="true">&times;</span>\
					</button>${msg}</div>`)[0];
				break;
			default:
				msg = 'Undefined error...';
				alertBlock = $.parseHTML(`<div class="alert alert-danger alert-dismissible" role="alert">\
					<button type="button" class="close" data-dismiss="alert" aria-label="Close">\
					<span aria-hidden="true">&times;</span>\
					</button>${msg}</div>`)[0];
				break;
		}

		if (!$(ele).get().length) {
			console.log('There is no custom alert block, use original js Alert function...');
			alert(`msg`);
		} else {
			$(ele).html(alertBlock);
			$(ele).fadeTo(4000, 500).slideUp(500, function(){
			    $(ele).slideUp(500);
			});
		}
	}

const confirmation = (event) => {
	const datasetId = $(event.target).closest('.panel-yellow').attr('id');
	$('#confirmModal').attr('data-datasetId', datasetId);
	$('#confirmModal').modal();
}

const deleteDataset = (event) => {
	console.log(event.target);
	const datasetId = $(event.target).closest('.modal').attr('data-datasetId').split('_')[1];
	const csrftoken = Cookies.get('csrftoken');
	if (datasetId) {
		const url = `/api/dataset/delete/${datasetId}`;
		$.ajax({
			url: url,
			type: 'delete',
			headers: {
				"X-CSRFToken": csrftoken,
			},
			success: (res) => {
				console.log(res.message);
				setTimeout(() => window.location.reload(), 200);
			},
		});
	}
	
}

const deleteNotif = (event) => {
	console.log(event.target);
	const alertId = $(event.target).closest('.alert').attr('id');
	const csrftoken = Cookies.get('csrftoken');
	if (alertId) {
		const url = `/api/alerts/delete/${alertId}`;
		$.ajax({
			url: url,
			type: 'delete',
			headers: {
				"X-CSRFToken": csrftoken,
			},
			success: (res) => {
				console.log(res.message);
			},
		});
	}
	
}

const editDataset = (event) => {
	console.log('#TODO...', $(event.target).closest(".panel-body").get());
	console.log('123', $(event.target).closest(".panel-yellow").children(".panel-footer").children("button").get().map((btn) => $(btn).html()));
	const datasetId = $(event.target).closest('.panel-yellow').attr('id');
	const datasetKeywords = $(event.target).closest(".panel-yellow").children(".panel-footer").children("button").get().map((btn) => $(btn).html());
	$('#editDatasetModal').attr('data-datasetId', datasetId);
	$('#editDatasetModal span#kube-name').html($(event.target).closest(".panel-body").children("span[name='kube']").html());
	$('#editDatasetModal span#dataset-date').html($(event.target).closest(".panel-body").children("span[name='date']").html());
	$('#editDatasetModal span#dataset-size').html($(event.target).closest(".panel-body").children("span[name='size']").html());

	$('#editDatasetModal input#dataset-title').val($(event.target).closest(".panel-yellow").children(".panel-heading").children("span[name='title']").html());
	$('#editDatasetModal input#dataset-description').val($(event.target).closest(".panel-body").children(" span[name='description']").html());
    $('#editDatasetModal input#dataset-keyword').tagsinput('removeAll');
    datasetKeywords.forEach(keyword => {
    	$('#editDatasetModal input#dataset-keyword').tagsinput('add', keyword);
    });
	$('#editDatasetModal').modal();
}

const updateDataset = (event) => {
	const csrftoken = Cookies.get('csrftoken');
	const updateObj = {};
	updateObj.dataset_id = $('#editDatasetModal').attr('data-datasetId');
	updateObj.title = $('#editDatasetModal .modal-body #dataset-title').val();
	updateObj.description = $('#editDatasetModal .modal-body #dataset-description').val();
	updateObj.keywords = $('#editDatasetModal .modal-body #dataset-keyword').val();
	console.log(123, updateObj);
	if (updateObj.dataset_id) {
		const url = 'api/dataset/edit';
		$.ajax({
			url: url,
			type: 'post',
			data: JSON.stringify(updateObj),
			headers: {
				"X-CSRFToken": csrftoken,
				"Content-Type": 'application/json',
			},
			success: (res) => {
				console.log(res.message);
			},
		});
	}
}
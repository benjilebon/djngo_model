(function ($) {
	const _datasets = [];
	const _input_infos = [];
	const _params_infos = [];
	const PERIOD_UNIT = [{ title: 'Minute', upperValue: 59 }, { title: 'Hour', upperValue: 23 }, { title: 'Day', upperValue: 30 }];

	const setDatasetFormat = async (formatInfo) => {
		$('#selectDatasetBtn').text(formatInfo.formatTitle);
		$('#selectDatasetBtn').attr('selected-format', formatInfo.formatId);
		try {
			const res1 = await getDatasetList(formatInfo.formatId);
			const res2 = await getAlgorithmList(formatInfo.formatId);
			// responseMsg('#alert_container', {status: 200});
			const tar_datasets = res1.datasets;
			const tar_algos = res2.algorithms;
			cleanBlock('#algorithm_container');
			cleanBlock('#algo_description');
			cleanBlock('#text_input');
			cleanBlock('#controlPanel_container');
			$('#algoType_container').css({display: 'none'});
			if (tar_datasets.length) {
				block_multiDataset(tar_datasets);
				block_algoSelector(tar_algos);
				$('#algoType_container').css({display: 'block'});
			} else {
				cleanBlock('#selectBox_container');
			}
		} catch(err) {
			console.log('err caught: ', err);
			responseMsg('#alert_container', err);
		}
	}

	const getDatasetList = (format) => {
		const url = `/api/dataset/list?dataFormat=${format}`;
		return $.get(url,  (result) => {
			return result;
		});
 	}

 	const getData = (datasetId) => {
		const url = `/api/dataset/${datasetId}`;
		$.get(url, (dataset) => {
			// data = dataset.data;
			const fields = dataset&&dataset.metadata&&dataset.metadata.fields; // check if there is field in dataset.metadata to get the column names  
			if (fields) {
				_datasets.push(dataset); // store dataset for judgement of application for other functions 
				if ($('div.input-select-container select').get().length) {
					input_select_add(dataset);
				}
			} else {
				console.log('fail to get data...');
			}
		})
	}

 	const getSelectedColumnData = (columnInfoX, columninfoY) => {
		const url = `/api/dataset/column`;
		const csrftoken = Cookies.get('csrftoken');
		const body = {};
		const datasets = [];
		const cols = {
			x: [],
			y: [],
		};
		datasets.push(columnInfoX.datasetId);
		cols.x.push({ column: columnInfoX.column, dataset: columnInfoX.datasetId });
		columninfoY.forEach((colInfo) => {
			datasets.push(colInfo.datasetId);
			cols.y.push({ column: colInfo.column, dataset: colInfo.datasetId });
		});

		const request_body = {
			datasets: datasets,
			columns: cols
		};

		return $.ajax({ 
			url: url,
			type: 'post',
			data: JSON.stringify(request_body), // For django cannot pass directly a json, should transform to dictionary
			headers: {
				"X-CSRFToken": csrftoken,
				"Content-Type": 'application/json', // set content type
			},
			success: (columns) => columns,
		});
	}

 	const getAlgorithmList = (format) => {
 		const url = `/api/algorithm/list?dataFormat=${format}`;
 		return $.get(url, (result) => {
 			return result;
 		});
 	}

 	const getAlgoInfo = (algoId) => {
 		const url = `/api/algorithm/${algoId}`;
 		return $.get(url, (result) => result);
 	}

 	const launchAnalysis = (request_body) => {
 		const url = `api/analysis/launch`;
 		const csrftoken = Cookies.get('csrftoken');

 		return $.ajax({ 
			url: url,
			type: 'post',
			data: JSON.stringify(request_body), // For django cannot pass directly a json, should transform to dictionary
			headers: {
				"X-CSRFToken": csrftoken,
				"Content-Type": 'application/json', // set content type
			},
			success: (res) => res,
		});
 	}

 	const block_multiDataset = (source) => {
		const innerHtml = document.createElement('div');
		innerHtml.className = "col-lg-12";
		source.forEach((item) => {
			let _container = document.createElement('div');
			_container.className = "form-check form-check-inline form-check-padding";
			let _input = document.createElement('input');
			_input.className = 'form-check-input';
			_input.setAttribute('type', 'checkbox');
			_input.setAttribute('value', item.id);
			_input.setAttribute('id', `inlineCheckbox${item.id}`);
			_input.addEventListener('change', (event) => {
				if (event.target.checked) {
					getData(event.target.value);
				} else {
					let index = _datasets.map((dataset) => dataset.id).indexOf(item.id);
					input_select_remove(item.id); // remove uncheck dataset's column from input select 
					_datasets.splice(index, 1);
					if (_datasets.length === 0) {
						cleanBlock('#text_input');
						cleanBlock('#algo_description');
						cleanBlock('#controlPanel_container'); // clean control panel block if there is no more dataset selected by user
						$('select#algorithm').val('placedholder');
					}
				}
			});
			_container.appendChild(_input);
			let _label = document.createElement('label');
			_label.textContent = item.title;
			_label.className = 'form-check-label';
			_label.setAttribute('for', `inlineCheckbox${item.id}`);
			_container.appendChild(_label);
			innerHtml.appendChild(_container);
		});
		$('#selectBox_container').html(innerHtml);
	}

	const block_algoSelector = (algos) => {
		const _label = $.parseHTML("<label for='disabledSelect'>Veuillez choisir l'algorithme à appliquer</label>")[0];
		const _select = $.parseHTML("<select required id='algorithm' name='algorithm' class='form-control'></select>")[0];
		_select.appendChild($.parseHTML(`<option value='placedholder' disabled selected >-- Veuillez choisir votre algorithm --</option>`)[0]);
		algos.forEach((algo) => {
			let _option = $.parseHTML(`<option value='${algo.id}' algo-type='${algo.type}'>${algo.title}</option>`)[0];
			_select.appendChild(_option);
		});

		_select.addEventListener('change', (event) => {
			if (event.target.value !== 'placedholder') {
				block_controlPanel(event.target.value);
			}
		});

		$('#algorithm_container').get(0).appendChild(_label);
		$('#algorithm_container').get(0).appendChild(_select);

	}

	const block_controlPanel = async (algoId) => {
		// const algo = await getAlgoInfo(algoId);
		const algo = await getAlgoInfo(algoId);
		console.log(111, algo);
		const params = Object.keys(algo.parameters);
		_input_infos.push(algo.inputs); // record input info 
		_params_infos.push(algo.parameters); // record params info

		$('#algo_description').html(algo.description);

		const allowed_kubex = $.parseHTML(`<select id="selected_kubex" class="form-control"></select>`)[0];

		// allowed_kubex.appendChild($.parseHTML(`<option value="*" selected>Veuillez choisir un Kubex</option>`)[0])
		algo.kubex_allowed.forEach(kubexInfo => {
			const _option = $.parseHTML(`<option value=${kubexInfo.id}>${kubexInfo.name}</option>`)[0];
			allowed_kubex.appendChild(_option);
		});

		const analysis_title = $.parseHTML(`<input id="analysis_title" type="text" class="form-control" placedholder="titre de l’analyse">`)[0];

		const analysis_description = $.parseHTML(`<textarea id="analysis_description" type="text" class="form-control" placedholder="description de l’analyse"></textarea>`)[0];

		const innerHtml = `<div class='col-lg-12'>\
							  <div class='panel panel-default'>\
  								<div class='panel-heading'>\
    								Options de analyse\
  								</div>\ 
  								<!-- /.panel-heading -->\
  								<div class='panel-body'>\
					            	<div id='panelContent' style='min-height:300px'></div>\
					          	</div>\
					          	<!-- /.panel-body -->\
					          </div>\
					        <!-- /.panel -->\
					       </div>`;

		const _form = $.parseHTML("<form id='submit_form'></form>")[0];

		const input_fileNames = Object.keys(algo.inputs);
		const fieldsInfo = [];
		console.log(333, Object.keys(algo.inputs));
		try {
			input_fileNames.forEach(fileName => {
			algo.inputs[fileName].fields.forEach(field => {
					fieldsInfo.push({field, fileName});
				});
			});
		} catch(err) {
			responseMsg('#alert_container', {status: 500, message: "ERROR: The algorithm information is not complety, please select another algorithm."})
			return false;
		}
		// const fields = algo.inputs[input_fileName].fields;
		const _selects = input_select_builder(fieldsInfo);
		// const _params = params_form_builder(params);

		if (_selects) {
			_form.appendChild($.parseHTML(`<h4>Input Field</h4>`)[0]);
			_selects.forEach((select) => {
				_form.appendChild(select);
			});
		} else {
			alert('Please select at least one dataset !!');
			cleanBlock('#text_input');
			cleanBlock('#controlPanel_container');
			cleanBlock('#algo_description');
			$('select#algorithm').val('placedholder');
			return false;
		}

		if (params.length) {
			_form.appendChild($.parseHTML(`<h4>Optional Parameter Field</h4>`)[0]);
			params.forEach((param) => {
				switch(algo.parameters[param].field) {
					case "input": 
						_form.appendChild(params_input_builder(algo.parameters[param], param));
						break;
					case "select":
						_form.appendChild(params_select_builder(algo.parameters[param], param));
						break;
					case "checkbox":
						_form.appendChild(params_checkbox_builder(algo.parameters[param], param));
						break;
					default:
						console.log("Error: invalid field type: must be 'input', 'select', or 'checkbox' !!");
				}
			});
		}

		const period_block_container = $.parseHTML("<div id='period-block-container'></div>")[0];
		const select_period_unit = $.parseHTML(`<select id="select-period-unit" class="form-control"></select>`)[0];
		select_period_unit.appendChild($.parseHTML(`<option value='' disabled selected >-- Veuillez choisir votre period --</option>`)[0]);
		PERIOD_UNIT.forEach(item => {
			const _option = $.parseHTML(`<option id=${item.title}>${item.title}</option>`)[0];
			select_period_unit.appendChild(_option);
		});

		select_period_unit.addEventListener('change', generatePeriodInput);
		period_block_container.appendChild(select_period_unit);
		_form.appendChild(period_block_container);

		const _btn = $.parseHTML(`<div><button type="button" class="btn btn-primary" style="margin-top:20px;" >Submit</button></div>`)[0];
		$(_btn).find('button').get(0).addEventListener('click', handleSubmit);
		_form.appendChild(_btn); 

		cleanBlock('#text_input');
		$('#text_input').get(0).appendChild($.parseHTML("<label for='selected_kubex'>Veuillez choisir un Kubex</label>")[0]);
		$('#text_input').get(0).appendChild(allowed_kubex);
		$('#text_input').get(0).appendChild($.parseHTML("<label for='analysis_title' style='margin-top:15px;'>Titre de l’analyse</label>")[0]);
		$('#text_input').get(0).appendChild(analysis_title);
		$('#text_input').get(0).appendChild($.parseHTML("<label for='analysis_description' style='margin-top:15px;'>Description de l’analyse</label>")[0]);
		$('#text_input').get(0).appendChild(analysis_description);

		$('#controlPanel_container').append(innerHtml);

		$('#panelContent').html(_form);
		// $('div.input-select-container select').multiselect(); // initialize component multiselect
		$('div.input-select-container select').get().forEach((select) => {
			const size = $(select).attr('limit');
			// initialize component multiselect with the limitation of select option number
			if (size !== '-1') {
				$(select).multiselect({
	            onChange: function(option, checked) {
	                // Get selected options.
	                const selectedOptions = $(select).find('option:selected');
	 
	                if (selectedOptions.length >= parseInt(size)) {
	                    // Disable all other checkboxes.
	                    // const nonSelectedOptions = $(select).find('option').filter(() => {
	                    // 	console.log(2727, $(this));
	                    // 	console.log(2828, this);
	                    //     return !$(this).is(':selected');
	                    // });

	                    const nonSelectedOptions = $($(select).find('option')).filter(function() {
	                    	return !$(this).is(':selected')
	                    });

	                    nonSelectedOptions.each(function() {
	                        // const input = $(select).parent().find('input[value="' + $(this).val() + '"]').filter(function() {return !$(this).prop('disable');}).first();
	                        const input = $(select).parent().find('input[value="' + $(this).val() + '"]'); // disabled all 
	                        input.prop('disabled', true);
	                        input.parent('li').addClass('disabled');
	                        const selected_input = $(select).parent().find('li.active').find('input');
	                        selected_input.prop('disabled', false);
	                        selected_input.parent('li').removeClass('disabled');
	                    });
	                }
	                else {
		                    // Enable all checkboxes.
		                     $(select).find('option').each(function() {
		                        const input = $('input[value="' + $(this).val() + '"]');
		                        input.prop('disabled', false);
		                        input.parent('li').addClass('disabled');
		                    });
		                }
		            }
		        });
			} else {
				$(select).multiselect({
					onChange: () => {
						console.log('select ->', select);
					}
				}); // initialize component multiselect for no-limit selection 
			}
		});
	} 

	const filterAlgo = () => {
		const type = $('#algoType').val();
		console.log('algo->', type);

		if ($('#algorithm option').get().length !== 0) {
			$('#algorithm option').each(function() {
				if ($(this).attr('algo-type') === type) {
					console.log(this);
					$(this).show();
				} else {
					$(this).hide();
				}

				if (type === '*') {
					$(this).show();
				}

				$('#algorithm').val('placedholder');
			});
		} else {
			console.log('No algorithm list info !');
		}
	}

	const input_select_builder = (fieldsInfo) => {
		console.log('#TODO: ', fieldsInfo);
		if (!_datasets.length) {
				console.log('No dataset selected!');
				return 0;
		}

		const res = [];

		fieldsInfo.forEach((fieldInfo) => {
			const selector_container = document.createElement('div');
			selector_container.className = 'input-select-container';
			const _title = $.parseHTML(`<h5><b>${fieldInfo.field.hint}</b></h5>`)[0];
			selector_container.appendChild(_title);
			console.log(555, `${fieldInfo.fileName + '-' + fieldInfo.field.fieldName}`);
			const _select = $.parseHTML(`<select id=${fieldInfo.fileName + '-' + fieldInfo.field.fieldName} multiple='multiple' limit=${fieldInfo.field.size} dataType=${fieldInfo.field.type} ></select>`)[0];
			_datasets.forEach((dataset) => {
				// const columns = Object.keys(dataset.data.data).filter(col => dataset.data.data[col].type === field.type); // select dataset columns which have the same type with field
				const columns = dataset.metadata.fields.map((field, idx) => {
					field.index = idx; // add index property as pre-process for allowing passing correct index in submit step
					return field;
				}).filter(item => fieldInfo.field.type.split('|').indexOf(item.data_type) !== -1).map(field => ({title: field.title, index: field.index})); // select dataset columns which have the same type with field
				const select_group = $.parseHTML(`<optgroup groupId=${dataset.id} label=${dataset.title}></optgroup>`)[0];
				columns.forEach(col => {
					const _option = document.createElement('option');
					_option.textContent = col.title;
					_option.setAttribute('value', dataset.id + '-' + col.title);
					_option.setAttribute('belongsTo', dataset.id);// attribute 'belongsTo' is used for marking this column is from which dataset
					_option.setAttribute('data-index', col.index);
					select_group.appendChild(_option);
				});
				_select.appendChild(select_group);
			});
			console.log('select for only one field->', _select);
			// _select.addEventListener('change', handleInput(event.target)); // currently no used...
			// if (field.size !== '-1') {
			// 	$(_select).multiselect({
		 //            onChange: function(option, checked) {
		 //                // Get selected options.
		 //                var selectedOptions = $('#example-limit option:selected');
		 
		 //                if (selectedOptions.length >= parseInt(field.size)) {
		 //                    // Disable all other checkboxes.
		 //                    var nonSelectedOptions = $('#example-limit option').filter(function() {
		 //                        return !$(this).is(':selected');
		 //                    });
		 
		 //                    nonSelectedOptions.each(function() {
		 //                        var input = $('input[value="' + $(this).val() + '"]');
		 //                        input.prop('disabled', true);
		 //                        input.parent('li').addClass('disabled');
		 //                    });
		 //                }
		 //                else {
		 //                    // Enable all checkboxes.
		 //                    $('#example-limit option').each(function() {
		 //                        var input = $('input[value="' + $(this).val() + '"]');
		 //                        input.prop('disabled', false);
		 //                        input.parent('li').addClass('disabled');
		 //                    });
		 //                }
		 //            }
		 //        });
			// }
			selector_container.appendChild(_select);
			res.push(selector_container);
		});

		return res;
	}

	const input_select_add = (dataset) => {
		const exist_selects = $('div.input-select-container select').get();
		if (exist_selects.length) {
			console.log('exit selects->', exist_selects);
			exist_selects.forEach((select) => {
				const select_group = $.parseHTML(`<optgroup groupId=${dataset.id} label=${dataset.title}></optgroup>`)[0];
				// const columns = Object.keys(dataset.data.data).filter(col => dataset.data.data[col].type === select.getAttribute('dataType')); // select dataset columns which have the same type with field
				const columns = dataset.metadata.fields.map((field, idx) => {
					field.index = idx; // add index property as pre-process for allowing passing correct index in submit step
					return field;
				}).filter(field => select.getAttribute('dataType').split('|').indexOf(field.data_type) !== -1).map(field => ({title: field.title, index: field.index})); // select dataset columns which have the same type with field;
				columns.forEach(col => {
					const _option = document.createElement('option');
					_option.textContent = col.title;
					_option.setAttribute('value', dataset.id + '-' + col.title);
					_option.setAttribute('belongsTo', dataset.id);// attribute 'belongsTo' is used for marking this column is from which dataset
					_option.setAttribute('data-index', col.index);
					select_group.appendChild(_option);
				});
				select.appendChild(select_group);
			});

			$('div.input-select-container select').multiselect('rebuild'); // update component multiselect
		} else {
			console.log('Error: cannot find input <select> element !');
		}
	}

	const input_select_remove = (datasetId) => {
		console.log('update input selector remove target dataset columns...');
		// console.log($(`optgroup[groupId=${datasetId}]`));
		// $(`option[belongsTo=${datasetId}]`).remove(); ///## Code for not specify a column is from which dataset 
		$(`optgroup[groupId=${datasetId}]`).remove();
		$('div.input-select-container select').multiselect('rebuild'); // update component multiselect
	}

	const handleInput = (select) => {
		console.log('#TODO2->', select);
	}

	const handleSubmit = async () => {
		const _analysis = {};
		let _input = {};
		const _params = {};

		// section analysis
		let selected_datasets = $('div.input-select-container select option:selected').get().map((option) => parseInt($(option).attr('belongsTo')));
		selected_datasets = selected_datasets.filter((dataset, index) => selected_datasets.indexOf(dataset) === index);
		const input_select = $('div.input-select-container select').get();
		_analysis.title = $('#analysis_title').val();
		_analysis.description = $('#analysis_description').val();
		_analysis.algorithm_id = $('#algorithm').val();
		_analysis.kubex_id = $('#selected_kubex').val();

		// section input
		_input = _input_infos[_input_infos.length - 1];
		// console.log(444, _input);
		Object.keys(_input).forEach((input) => {
			_input[input].fields.forEach((field) => {
				let temp = input;
				if (temp.indexOf('.') !== -1) {
					temp = temp.split('.').join('\\.'); // for jQuery it canont understand specific characters in its selector, for example ".",  we need to add "\\" before these characters.  
				}
				// field.values = $(`#${temp}-${field.fieldName}`).val();
				// console.log(777, `${temp + '-' + field.fieldName}`);
				field.values = $(`#${temp + '-' + field.fieldName} option:selected`).get().map((option) => ({dataset: $(option).attr('belongsTo'), column: $(option).val(), column_index: $(option).attr('data-index')}));
				delete field.size;
				delete field.hint;
				delete field.type;
			});
			_input[input].fields.sort((a, b) => b.fileField < a.fileField); // sort the fileds by its fileField
		});

		// section parameters
		const _paramInfo = _params_infos[_params_infos.length - 1];
		Object.keys(_paramInfo).forEach((param) => {
			_params[_paramInfo[param].position] = {};
			_params[_paramInfo[param].position].prefix = _paramInfo[param].prefix;
			_params[_paramInfo[param].position].value = $(`#param-${param.replace(/\s/g, '-')}`).val() || $(`#param-${param.replace(/\s/g, '-')}`).attr('data-defaultValue');
		});

		// judge if the user has completed title and description

		if (!_analysis.title || !_analysis.description) {
			alert('Please fulfill all the title and description fields before submit !!');
			return false;
		}

		// judge if the user has select all input selects before calling api
		const judgement_input = Object.keys(_input).some((input) => {
			return _input[input].fields.some((field) => field.values.length === 0);
		});

		const judgement_params = Object.keys(_paramInfo).some((param) => {
			return !RegExp($(`#param-${param.replace(/\s/g, '-')}`).attr('pattern')).test($(`#param-${param.replace(/\s/g, '-')}`).val());
		});

		if (judgement_input) {
			alert('Please fulfill all the input fields before submit !!');
			return false;
		}

		if (judgement_params) {
			alert('Please make sure all the values of optional parameter fields are correct !!');
			return false;
		}		
		// return the request body
		const request_body = {
			analyse: _analysis,
			inputs: _input,
			parameters: _params,
			datasets: selected_datasets,
		};

		if ($('#select-period-unit').val()) {
			request_body.periodic_task = {};
			request_body.periodic_task.period = $('#select-period-unit').val().toLowerCase() + 's';
			request_body.periodic_task.every = parseInt($('input#period-value').val());
		}

		console.log(666, request_body);

		try{
			const res = await launchAnalysis(request_body);
			window.scrollTo(0, 0);
			responseMsg('#alert_container', {status: 200});
			setTimeout(() => window.location.reload(), 2000);
		} catch(err) {
			window.scrollTo(0, 0);
			responseMsg('#alert_container', err);

		}


	}

	// const params_form_builder = (params) => {
	// 	console.log('params->', params);
	// 	const res = [];
	// 	params.forEach((param) => {
	// 		console.log(887, param);
	// 		switch(param.field) {
	// 			case "input": 
	// 				res.push(params_input_builder(param));
	// 				break;
	// 			case "select":
	// 				res.push(params_select_builder(param));
	// 				break;
	// 			case "checkbox":
	// 				res.push(params_checkbox_builder(param));
	// 				break;
	// 			default:
	// 				console.log("Error: invalid field type: must be 'input', 'select', or 'checkbox' !!");
	// 		}
	// 	});
	// 	return res;
	// }

	const params_input_builder = (param, paramName) => {
		const _block = $.parseHTML(`<div class="form-group">
    			<label for=${paramName} title="${param.hint}" >${paramName}</label>
  			</div>`)[0];
		// replace all spaces in paramName, or jQuery selector may not be able to find target element 
		const _input = $.parseHTML(`<input id="param-${paramName.replace(/\s/g, '-')}" type="text" class="form-control" pattern=${param.regex} placeholder="${param.hint}" value=${param.default} data-defaultValue=${param.default} data-position=${param.position} data-prefix=${param.prefix} >`)[0];
		const _reminder = $.parseHTML(`<p id="param-${paramName.replace(/\s/g, '-')}-reminder"></p>`)[0];
		_input.addEventListener('input', (event) => {
			$(event.target).css('border', () => event.target.reportValidity() ? '1px solid #ccc' : '1px solid #ee1a3b');
			$(`#param-${paramName.replace(/\s/g, '-')}-reminder`).html(() => event.target.reportValidity() ? null : $.parseHTML("<b style='color:#ee1a3b'>Invalid Value</b>")[0]);
			return event.target.reportValidity();
		});
		_block.appendChild(_input);
		_block.appendChild(_reminder);

		return _block;
	}

	const params_select_builder = (param, paramName) => {
		return $.parseHTML(`<h4>${param.hint}</h4>`);
	}

	const params_checkbox_builder = (param, paramName) => {
		return $.parseHTML(`<h4>${param.hint}</h4>`);
	}

	const generatePeriodInput = () => {
		$('#period-input-container').remove();
		const _container = $.parseHTML("<div id='period-input-container' style='margin-top:20px;width:100%';></div>")[0];
		const period_unit = $('#select-period-unit').val();
		const maxValue = PERIOD_UNIT.filter(item => item.title === period_unit)[0].upperValue;
		const period_input = $.parseHTML(`<input id="period-value" type="range" min="0" max=${maxValue} value="0" />`)[0];
		const _tickmarks = $.parseHTML("<div id='tickmarks' class='sliderticks'></div>")[0];
		for(let i = 0; i <= maxValue; i++) {
			const _item = $.parseHTML(`<p>${i%5 === 0 ? i : ''}</p>`)[0];
			if (i === maxValue) {
				$(_item).html(maxValue);
			}
			_tickmarks.appendChild(_item);
		}
		const _label = $.parseHTML(`<label>0 ${period_unit.toLowerCase()}s</label>`)[0];

		period_input.addEventListener('change', () => {
			const period_value = $('#period-value').val();
			console.log(124, period_unit);
			$('#period-input-container label').html(`${period_value} ${period_unit.toLowerCase()}s`);
		});

		_container.appendChild(period_input);
		_container.appendChild(_tickmarks);
		_container.appendChild(_label);
		$('div#period-block-container').get(0).appendChild(_container);
	}

	const cleanBlock = (ele) => {
		$(ele).html(null);
	}

 	$('ul#format li a').get().forEach((ele)=> {
		ele.addEventListener('click', (event) => setDatasetFormat({formatId: $(event.target).attr('data-id'), formatTitle: $(event.target).text()}));
	});

	$('select#algoType').get()[0].addEventListener('change', filterAlgo);

	// code for block shiftclick when click on the options of multiselect, for now doesn't work...
	var shiftClick = jQuery.Event("click");
	shiftClick.shiftKey = true;

    $(".multiselect-container li * ").click(function(event) {
        if (event.shiftKey) {
           alert("Shift key is pressed");
            event.preventDefault();
            return false;
        }
        else {
           alert('No shift key');
        }
    });
})(jQuery);
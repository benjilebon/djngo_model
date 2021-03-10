(function($) {
	// let _data = [];
	let _datasets = [];
	const ALLOWED_DATATYPE_MAP = {
		T: ['integer', 'float', 'string', ],
		I: ['jpg', 'png', 'bmp', 'jpeg', 'gif', 'svg'],
		A: ['mp3', 'wav', 'ogg', 'haw', 'flac'],
		V: ['avi', 'wmv', 'mov'],
	};
	// let _temp = null; // temporaty list to store ids & titles of dataset, because at present the 'getData' api we can only get the data of dataset, cannot get the whole dataset obj
					// (includes 'title' which we need for set title text in graphic function), so we need this variable to store the titles for us. 

	const setDatasetFormat = async (formatInfo) => {
		console.log(formatInfo);
		$('#selectDatasetBtn').text(formatInfo.formatTitle);
		const res = await getDatasetList(formatInfo.formatId);
		const tar_datasets = res.datasets;
		console.log('dataset list->', res);
		// const selectables = filterDataset(dataFormat);
		// console.log('tar_datasets->', tar_datasets)
		$('#graphic_container').html(" <h3>No data.</h3>");
		cleanBlock('#controlPanel_container');
		if (tar_datasets.length) {
			// _temp = tar_datasets;
			block_multiDataset(tar_datasets);
		} else {
			cleanBlock('#selectBox_container');
		}
	}

	const getDatasetList = (format) => {
		const url = `/api/dataset/list?dataFormat=${format}`;
		return $.get(url,  (result) => {
			// console.log('result ->', result);
			return result.datasets;
		});
 	}

	const getData = (datasetId) => {
		const url = `/api/dataset/${datasetId}`;
		$.get(url, (dataset) => {
			console.log('dataset->', dataset);
			const fields = dataset&&dataset.metadata&&dataset.metadata.fields; // check if there is field in dataset.metadata to get the column names 
			if (fields) {
				cleanBlock('#graphic_container');
				const innerHtml = "<div class='col-lg-12' >\
        							  <div class='panel panel-default'>\
          								<div class='panel-heading'>\
            								Visulisation\
          								</div>\
          								<!-- /.panel-heading -->\
          								<div class='panel-body'>\
							            	<div id='echarts-chart' style='height:500px'></div>\
							          	</div>\
							          	<!-- /.panel-body -->\
							          </div>\
							        <!-- /.panel -->\
							       </div>";
				$('#graphic_container').html(innerHtml);
				// const title = (_temp.filter((item) => item.id === parseInt(datasetId)))[0].title;
				if (_datasets.length === 0) {
					create_controlPanel(dataset); // if it is the first time we get a dataset, create control panel
				} else {
					update_controlPanel_add(dataset); // if there is already a control panel, update it to add new dataset's data column 
				}
				// _data.push({id: datasetId, data: data}); // store data in a local variable for judging if we still need to draw the graphic
				_datasets.push(dataset); // store dataset for judgement of application for other functions 
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
		cols.x.push({ column: columnInfoX.column, dataset: columnInfoX.datasetId, column_index: columnInfoX.column_index });
		columninfoY.forEach((colInfo) => {
			datasets.push(colInfo.datasetId);
			cols.y.push({ column: colInfo.column, dataset: colInfo.datasetId, column_index: colInfo.column_index });
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

	const cleanBlock = (ele) => {
		$(ele).html(null);
	}

	// const filterDataset = (excludeId) => {
	// 	let targetDatasets = [];
	// 	$('ul#datasets li a').get().forEach((ele) => {
	// 		let _id = $(ele).attr('data-id');
	// 		let _title = $(ele).html();
	// 		if (_id !== excludeId) {
	// 			targetDatasets.push({id: _id, title: _title});
	// 		}				
	// 	});
	// 	return targetDatasets;
	// }

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
					// console.log(event.target);
					getData(event.target.value);
				} else {
					let index = _datasets.map((dataset) => dataset.id).indexOf(item.id);
					update_controlPanel_remove(item.id); // remove uncheck dataset's column from comtrol panel 
					_datasets.splice(index, 1);
					if (_datasets.length === 0) {
						$('#graphic_container').html(" <h3>Aucun dataset sélectionné</h3>"); // clean graphic block if there is no dataset selected by user
						cleanBlock('#controlPanel_container'); // clean control panel block if there is no more dataset selected by user
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

	const create_controlPanel = (dataset) => {
		// const columns = Object.keys(dataset.data.data);
		// const columns = dataset.metadata.fields.map(field => field.title);
		const columns = dataset.metadata.fields;
		const allowedDataType = ALLOWED_DATATYPE_MAP[dataset.metadata.data_format]; // set data types which is allowed to select for launch chart_linear_regression function
		const innerHtml = `<div class='col-lg-12'>\
							  <div class='panel panel-default'>\
  								<div class='panel-heading'>\
    								Options de visualisation\
  								</div>\ 
  								<!-- /.panel-heading -->\
  								<div class='panel-body'>\
					            	<div id='panelContent' style='height:500px'></div>\
					          	</div>\
					          	<!-- /.panel-body -->\
					          </div>\
					        <!-- /.panel -->\
					       </div>`;

		$('#controlPanel_container').append(innerHtml);

		switch(dataset.metadata.data_format) {
			case 'T':
				create_controlPanel_table(dataset);
				break;
			case 'I':
				create_controlPanel_image(dataset);
				break;
			default:
				create_controlPanel_table(dataset);
		}

	}// for generation of controll panel for selected dataset based on it's value

	const create_controlPanel_table = (dataset) => {
		const columns = dataset.metadata.fields;
		const allowedDataType = ALLOWED_DATATYPE_MAP[dataset.metadata.data_format]; // set data types which is allowed to select for launch chart_linear_regression function

		const xSelector_container = document.createElement('div');
		const ySelector_container = document.createElement('div');
		xSelector_container.className = 'xSelector-container';
		ySelector_container.className = 'ySelector-container';
		const _titleX = $.parseHTML('<h4>Données de l\'axe X:</h4>')[0];
		const _titleY = $.parseHTML('<h4>Données de l\'axe Y:</h4>')[0];
		xSelector_container.appendChild(_titleX);
		ySelector_container.appendChild(_titleY);

		// element <select> for X axis
		const selector_xAxis = document.createElement('select');
		const select_groupX = $.parseHTML(`<optgroup groupId=${dataset.id} label=${dataset.title}></optgroup>`)[0];
		selector_xAxis.className = 'selector-xAxis btn btn-default';
		selector_xAxis.setAttribute('id', 'selector-x');
		selector_xAxis.appendChild($.parseHTML('<option value="" disabled selected >None Selected</option>')[0]);
		// selector_xAxis.appendChild(select_groupX);

		// element <select> for Y axis
		const selector_yAxis = document.createElement('select');
		const select_groupY = $.parseHTML(`<optgroup groupId=${dataset.id} label=${dataset.title}></optgroup>`)[0];
		selector_yAxis.setAttribute('id', 'selector-y');
		selector_yAxis.setAttribute('multiple', 'multiple');
		// selector_yAxis.appendChild(select_groupY);

		console.log(200, dataset.metadata.fields);
		columns.forEach((column, idx) => {
			const _option1 = document.createElement('option');
			const _option2 = document.createElement('option'); // an element node object cannot be appended to 2 different ele node, or it will ONLY be appended to last ele node. so we need to create a copy.
			_option1.textContent = column.title;
			_option1.setAttribute('value', dataset.id + '-' + column.title);
			_option1.setAttribute('belongsTo', dataset.id);// attribute 'belongsTo' is used for marking this column is from which 
			_option1.setAttribute('data-index', idx);
			
			_option2.textContent = column.title;
			_option2.setAttribute('value', dataset.id + '-' + column.title);
			_option2.setAttribute('belongsTo', dataset.id);// attribute 'belongsTo' is used for marking this column is from which 
			_option2.setAttribute('data-index', idx);

			if (allowedDataType.indexOf(column.data_type) === -1) {
				_option1.setAttribute('disabled', 'disabled');
				_option2.setAttribute('disabled', 'disabled');
			}

			// selector_xAxis.appendChild(_option1);
			// selector_yAxis.appendChild(_option2);
			select_groupX.appendChild(_option1);
			select_groupY.appendChild(_option2);
		});

		selector_xAxis.appendChild(select_groupX);
		selector_yAxis.appendChild(select_groupY);

		xSelector_container.appendChild(selector_xAxis);

		// const selector_yAxis = document.createElement('select');
		// // const select_groupY = $.parseHTML(`<optgroup id=${'optgroup-y-' + dataset.id} label=${dataset.title}></optgroup>`)[0];
		// selector_yAxis.setAttribute('id', 'selector-y');
		// selector_yAxis.setAttribute('multiple', 'multiple');
		// // selector_yAxis.appendChild(select_groupY);
		// columns.forEach((column) => {
		// 	const _option = document.createElement('option');
		// 	_option.textContent = column;
		// 	_option.setAttribute('value', column);
		// 	_option.setAttribute('belongsTo', dataset.id);// attribute 'belongsTo' is used for marking this column is from which 
		// 	// select_groupY.appendChild(_option);
		// 	selector_yAxis.appendChild(_option);
		// });

		ySelector_container.appendChild(selector_yAxis);

		$('#panelContent').append(xSelector_container);
		$('#panelContent').append(ySelector_container);
		$('select#selector-y').multiselect(); // initialize component multiselect

		$('select#selector-y').change( function() {
		        let val = $('option:selected',this).attr('belongsTo')

		        console.log(886, val);
		    }
		); 

		const submit_btn = $.parseHTML("<button class='btn btn-primary' style='margin-top:10px;' >Submit</button>")[0]; 
		submit_btn.addEventListener('click', generateGraphic);
		$('#panelContent').append(submit_btn);
	}

	const create_controlPanel_image = (dataset) => {
		const columns = dataset.metadata.fields;
		const allowedDataType = ALLOWED_DATATYPE_MAP[dataset.metadata.data_format]; // set data types which is allowed to select for launch chart_linear_regression function

		const selector_container = document.createElement('div');
		selector_container.className = 'selector-container';
		const _title = $.parseHTML('<h4>Selecionner une liste des images à présenter:</h4>')[0];
		selector_container.appendChild(_title);

		// element <select>
		const selector = document.createElement('select');
		const select_group = $.parseHTML(`<optgroup groupId=${dataset.id} label=${dataset.title}></optgroup>`)[0];
		selector.className = 'btn btn-default';
		selector.setAttribute('id', 'image-selector');
		selector.appendChild($.parseHTML('<option value="" disabled selected >None Selected</option>')[0]);

		console.log(200, dataset.metadata.fields);
		columns.forEach((column, idx) => {
			const _option = document.createElement('option');
			_option.textContent = column.title;
			_option.setAttribute('value', dataset.id + '-' + column.title);
			_option.setAttribute('belongsTo', dataset.id);// attribute 'belongsTo' is used for marking this column is from which 
			_option.setAttribute('data-index', idx);
			_option.setAttribute('data-format', column.data_type); // Exist only in "controlPanel_image"

			if (allowedDataType.indexOf(column.data_type) === -1) {
				_option.setAttribute('disabled', 'disabled');
			}

			select_group.appendChild(_option);
		});

		selector.appendChild(select_group);

		selector_container.appendChild(selector);

		$('#panelContent').append(selector_container);
		// $('select#selector-y').multiselect(); // initialize component multiselect

		// $('select#selector-y').change( function() {
		//         let val = $('option:selected',this).attr('belongsTo')

		//         console.log(886, val);
		//     }
		// ); 

		const submit_btn = $.parseHTML("<button class='btn btn-primary' style='margin-top:10px;' >Submit</button>")[0]; 
		submit_btn.addEventListener('click', generateImageSlider);
		$('#panelContent').append(submit_btn);
	}

	const update_controlPanel_add = (dataset) => {

		switch(dataset.metadata.data_format) {
			case 'T':
				update_controlPanel_add_table(dataset);
				break;
			case 'I':
				update_controlPanel_add_image(dataset);
				break;
			default:
				update_controlPanel_add_table(dataset);
		}

	}

	const update_controlPanel_add_table = (dataset) => {
		// const columns = Object.keys(dataset.data.data);
		// const columns = dataset.metadata.fields.map(field => field.title);
		const columns = dataset.metadata.fields;
		const allowedDataType = ALLOWED_DATATYPE_MAP[dataset.metadata.data_format]; // set data types which is allowed to select for launch chart_linear_regression function
		const selector_xAxis = $('select#selector-x').get(0);
		const selector_yAxis = $('select#selector-y').get(0);
		if (selector_xAxis && selector_yAxis) {
			console.log('update selector X & Y add new columns...');
			// const select_groupX = $.parseHTML(`<optgroup id=${dataset.title} label=${dataset.title}></optgroup>`)[0];
			
			//## Code for not specify a column is from which dataset  
			// const exist_columns = $('select#selector-x option').get().map((option) => {if (option.value) { return option.value; }}).filter((option) => {if (option) return option; {}}); // get all columns that exits in selector X & Y
			// const new_columns = columns.filter((col) => exist_columns.indexOf(col) === -1); // filter columns that in the new come datasets to add in selector X & Y
			// new_columns.forEach((column) => {
			// 	const _option1 = $.parseHTML(`<option value=${column}>${column}</option>`)[0];
			// 	const _option2 = $.parseHTML(`<option value=${column}>${column}</option>`)[0]; // an element node object cannot be appended to 2 different ele node, or it will ONLY be appended to last ele node. so we need to create a copy.
			// 	_option1.setAttribute('belongsTo', dataset.id);// attribute 'belongsTo' is used for marking this column is from which 
			// 	_option2.setAttribute('belongsTo', dataset.id);// attribute 'belongsTo' is used for marking this column is from which 
			// 	// select_groupX.appendChild(_option);
			// 	selector_xAxis.appendChild(_option1);
			// 	selector_yAxis.appendChild(_option2);
			// });
			//## Code for not specify a column is from which dataset 

			const select_groupX = $.parseHTML(`<optgroup groupId=${dataset.id} label=${dataset.title}></optgroup>`)[0]; 
			const select_groupY = $.parseHTML(`<optgroup groupId=${dataset.id} label=${dataset.title}></optgroup>`)[0];

			columns.forEach((column, idx) => {
				const _option1 = $.parseHTML(`<option value=${dataset.id + '-' + column.title}>${column.title}</option>`)[0];
				const _option2 = $.parseHTML(`<option value=${dataset.id + '-' + column.title}>${column.title}</option>`)[0]; // an element node object cannot be appended to 2 different ele node, or it will ONLY be appended to last ele node. so we need to create a copy.
				
				_option1.setAttribute('belongsTo', dataset.id);// attribute 'belongsTo' is used for marking this column is from which 
				_option1.setAttribute('data-index', idx);
				_option2.setAttribute('belongsTo', dataset.id);// attribute 'belongsTo' is used for marking this column is from which 
				_option2.setAttribute('data-index', idx);

				if (allowedDataType.indexOf(column.data_type) === -1) {
					_option1.setAttribute('disabled', 'disabled');
					_option2.setAttribute('disabled', 'disabled');
				}

				select_groupX.appendChild(_option1);
				select_groupY.appendChild(_option2);
			});

			selector_xAxis.appendChild(select_groupX);
			selector_yAxis.appendChild(select_groupY);

			$('select#selector-y').multiselect('rebuild'); // update component multiselect
		}
		else {
			console.log('Error: cannot find <select> element selector-x and/or selector-y!');
		}
	}

	const update_controlPanel_add_image = (dataset) => {
		const columns = dataset.metadata.fields;
		const allowedDataType = ALLOWED_DATATYPE_MAP[dataset.metadata.data_format]; // set data types which is allowed to select for launch chart_linear_regression function
		const image_selector = $('select#image-selector').get(0);

		if (image_selector) {
			console.log('update image-selector add new image sets...');

			const select_group = $.parseHTML(`<optgroup groupId=${dataset.id} label=${dataset.title}></optgroup>`)[0]; 

			columns.forEach((column, idx) => {
				const _option = $.parseHTML(`<option value=${dataset.id + '-' + column.title}>${column.title}</option>`)[0];
				
				_option.setAttribute('belongsTo', dataset.id);// attribute 'belongsTo' is used for marking this column is from which 
				_option.setAttribute('data-index', idx);
				_option.setAttribute('data-format', column.data_type); // Exist only in "controlPanel_image"

				if (allowedDataType.indexOf(column.data_type) === -1) {
					_option.setAttribute('disabled', 'disabled');
				}

				select_group.appendChild(_option);
			});

			image_selector.appendChild(select_group);

		}
		else {
			console.log('Error: cannot find <select> element image-selector!');
		}

	}

	const update_controlPanel_remove = (datasetId) => {
		console.log('update selector X & Y remove target dataset columns...');
		// console.log($(`optgroup[groupId=${datasetId}]`));
		// $(`option[belongsTo=${datasetId}]`).remove(); ///## Code for not specify a column is from which dataset 
		$(`optgroup[groupId=${datasetId}]`).remove();
		$('select#selector-y').multiselect('rebuild'); // update component multiselect
	}

	const generateGraphic = async () => {
		cleanBlock('#graphic_container');

		let column_is_valid = true;
		const innerHtml = "<div class='col-lg-12' >\
							  <div class='panel panel-default'>\
  								<div class='panel-heading'>\
    								Visulisation\
  								</div>\
  								<!-- /.panel-heading -->\
  								<div class='panel-body'>\
					            	<div id='echarts-chart' style='height:500px'></div>\
					          	</div>\
					          	<!-- /.panel-body -->\
					          </div>\
					        <!-- /.panel -->\
					       </div>";
		$('#graphic_container').html(innerHtml);
		const selected_index = $('select#selector-x').get(0).selectedIndex;
		const selected_index2 = $('select#selector-y').get(0).selectedIndex;

		const selected_optionX = $('select#selector-x :selected').get(0);
		console.log(999, selected_optionX);
		const selected_optionsY = $('select#selector-y option:selected').get();
		console.log(1010, selected_optionsY);

		const selected_columnX = {datasetId: selected_optionX.getAttribute('belongsTo'), column: selected_optionX.textContent, column_index: selected_optionX.getAttribute('data-index')};
		const selected_columnsY = selected_optionsY.map((option) => ({
			datasetId: option.getAttribute('belongsTo'), 
			column: option.textContent,
			column_index: option.getAttribute('data-index'),
		}));

		// console.log(selected_columnX, selected_columnsY);

		selected_columnsY.some((column) => {
			if (column.datasetId !== selected_columnX.datasetId) {
				console.log('there is at least one column Y not belongs to the dataset of current selected X');
				column_is_valid = false;
				return true;
			}
		});

		if (!column_is_valid) {
			$('#echarts-chart').html('Error, current not support cross-selection of different datasets !');
		}
		else {
			const res = await getSelectedColumnData(selected_columnX, selected_columnsY);
			// const data_points = process_data(selected_columnX, selected_columnsY);
			console.log('target column data -> ', res);
			const targetDataX = res.x[0];
			const targetDataY = res.y;
			const data_points = process_data(targetDataX, targetDataY);
			chart_linear_regression(data_points, 'Demo Linear Regression Chart');

		}

	}

	const generateImageSlider = async () => {
		cleanBlock('#graphic_container');
		const innerHtml = "<div class='col-lg-12' >\
							  <div class='panel panel-default'>\
  								<div class='panel-heading'>\
    								Visulisation\
  								</div>\
  								<!-- /.panel-heading -->\
  								<div class='panel-body'>\
					            	<div id='image-slider' style='height:auto' class='carousel slide' data-ride='carousel'></div>\
					          	</div>\
					          	<!-- /.panel-body -->\
					          </div>\
					        <!-- /.panel -->\
					       </div>";
		$('#graphic_container').html(innerHtml);

		const selected_image = $('select#image-selector :selected').get(0);
		const datasetId = selected_image.getAttribute('belongsTo');
		const imageFormat = selected_image.getAttribute('data-format');
		const abs_time = $(`select#image-selector option[value=${datasetId + '-abs_time'}]`).get(0); // By default we assume that each image list must has a correspondent abs_time list
		console.log('selected image -> ', selected_image);
		console.log('abs time -> ', abs_time);

		const selected_columnX = {datasetId: abs_time.getAttribute('belongsTo'), column: abs_time.textContent, column_index: abs_time.getAttribute('data-index')};
		const selected_columnsY = [ {datasetId: selected_image.getAttribute('belongsTo'), column: selected_image.textContent, column_index: selected_image.getAttribute('data-index')} ];
	
		const res = await getSelectedColumnData(selected_columnX, selected_columnsY);
		console.log('target column data -> ', res);
		const imageObj = res.y[0];
		const sliderWrapper = $.parseHTML("<div class='carousel-inner' role='listbox'></div>")[0];

		imageObj.values.forEach((image, idx) => {
			const sliderItem = idx === 0? $.parseHTML("<div class='item active'></div>")[0] : $.parseHTML("<div class='item'></div>")[0];
			const img = $.parseHTML(`<img src='data:image/${imageFormat};base64,${image}' alt='Image Item' style='width:100%;'>`)[0];
			sliderItem.appendChild(img);
			sliderWrapper.appendChild(sliderItem);
		});

		const sliderBtnLeft = $.parseHTML("<a class='left carousel-control' id='btn-prev' href='#image-slider' style='display:none;' role='button' data-slide='prev'>\
    								<span class='glyphicon glyphicon-chevron-left' aria-hidden='true'></span>\
    								<span class='sr-only'>Previous</span>\
  								  </a>")[0];
  		const sliderBtnRight = $.parseHTML("<a class='right carousel-control' id='btn-next' href='#image-slider' style='display:none;' role='button' data-slide='next'>\
    								<span class='glyphicon glyphicon-chevron-right' aria-hidden='true'></span>\
    								<span class='sr-only'>Next</span>\
  								  </a>")[0];

		sliderWrapper.appendChild(sliderBtnLeft);
		sliderWrapper.appendChild(sliderBtnRight);
		$('div#image-slider').html(sliderWrapper);
		$('div#image-slider').hover(() => {
			$('div#image-slider #btn-prev').show();
			$('div#image-slider #btn-next').show();
		}, () => {
			$('div#image-slider #btn-prev').hide();
			$('div#image-slider #btn-next').hide();
		});

		$('body').scrollTop();
	}

	const process_data = (targetDataX, targetDataY) => {
		// console.log(_datasets.filter((dataset) => dataset.id === columnInfoX.datasetId));
		// console.log(columnInfoX, columnInfoY);
		// const targetDataX = _datasets.filter((dataset) => dataset.id === parseInt(columnInfoX.datasetId))[0].data.data[columnInfoX.column];
		// const targetDataY = columnInfoY.map((info) => {
		// 	let temp_dataset = _datasets.filter((dataset) => dataset.id === parseInt(info.datasetId))[0];
		// 	return temp_dataset.data.data[info.column];
		// });

		// console.log('targetdataX-> ', targetDataX);
		// console.log('targetdataY-> ', targetDataY);

		const data_points = [];

		targetDataY.map((itemY) => {
			if (itemY.values.length === targetDataX.values.length) {
				let temp1 = [];
				for (let i = 0; i < parseInt(targetDataX.values.length);i++) {
					let temp2 = [];
					temp2.push(targetDataX.values[i]);
					temp2.push(itemY.values[i]);
					temp1.push(temp2);
				}
				data_points.push(temp1);
			}
		});

		return data_points;

	}

	$('ul#format li a').get().forEach((ele)=> {
		ele.addEventListener('click', (event) => setDatasetFormat({formatId: $(event.target).attr('data-id'), formatTitle: $(event.target).text()}));
	});

	const chart_linear_regression = (data, title) => {

		const option = {
		    title: {
		        text: title,
		        left: 'center'
		    },
		    tooltip: {
		        trigger: 'axis',
		        axisPointer: {
		            type: 'cross'
		        }
		    },
		    xAxis: {
		        type: 'value',
		        splitLine: {
		            lineStyle: {
		                type: 'dashed'
		            }
		        },
		        // boundaryGap: ['20%', '20%'], // set boundary gap for max value and min value
		        // max: value => 1.2 * value.max,
		        // min: value => 0.8 * value.min,
		         scale: true
		    },
		    yAxis: {
		        type: 'value',
		        // min: 1.5,
		        splitLine: {
		            lineStyle: {
		                type: 'dashed'
		            }
		        },
		        // boundaryGap: ['20%', '20%'], // set boundary gap for max value and min value
		        // max: value => 1.2 * value.max,
		        // min: value => 0.8 * value.min,
		         scale: true
		    },
		    dataZoom: [
				        {
				            type: 'slider',
				            show: true,
				            xAxisIndex: [0],
				            start: 0,
				            end: 100
				        },
				        {
				            type: 'slider',
				            show: true,
				            yAxisIndex: [0],
				            left: '93%',
				            start: 0,
				            end: 100
				        },
				        {
				            type: 'inside',
				            xAxisIndex: [0],
				            start: 0,
				            end: 100
				        },
				        {
				            type: 'inside',
				            yAxisIndex: [0],
				            start: 40,
				            end: 100
				        }
				    ],
		    series: []
		};

		data.forEach((item, index) => {
			const myRegression = ecStat.regression('linear', item);
			myRegression.points.sort(function(a, b) {
			    return a[0] - b[0];
			});

			let _scatter = {
				name: `scatter-${index}`, // different name to show different color of points/lines
		        type: 'scatter',
		        label: {
		            emphasis: {
		                show: true,
		                position: 'left',
		                textStyle: {
		                    color: 'blue',
		                    fontSize: 16
		                }
		            }
		        },
		        data: item
			};

			let _line = {
		        name: `regression-${index}`, // different name to show different color of points/lines
		        type: 'line',
		        showSymbol: false,
		        data: myRegression.points,
		        markPoint: {
		            itemStyle: {
		                normal: {
		                    color: 'transparent'
		                }
		            },
		            label: {
		                normal: {
		                    show: true,
		                    position: 'left',
		                    formatter: myRegression.expression,
		                    textStyle: {
		                        color: '#333',
		                        fontSize: 14
		                    }
		                }
		            },
		            data: [{
		                coord: myRegression.points[myRegression.points.length - 1]
		            }]
		        }
		    };

		    option.series.push(_scatter);
		    option.series.push(_line);
		});
		const myChart = echarts.init(document.getElementById('echarts-chart'));
		myChart.setOption(option);
		window.addEventListener('resize', myChart.resize);
	} 

})(jQuery);
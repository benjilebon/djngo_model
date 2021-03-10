const ALLOWED_DATATYPE_MAP = {
		T: ['integer', 'float', 'string', ],
		I: ['jpg', 'png', 'bmp', 'jpeg', 'gif', 'svg'],
		A: ['mp3', 'wav', 'ogg', 'haw', 'flac'],
		V: ['avi', 'wmv', 'mov'],
	};
const DATA_FORMAT_MAP = {
	T: 'Table',
	I: 'Image',
	A: 'Audio',
	V: 'Video',
};

const editKubeConfiguration = (event) => {
		const sn = $(event.target).closest(".panel-primary").children(".panel-body").children("span[name='sn']").html();
		if(sn) {
			$('#kubeConfigModal').attr('data-sn', sn);
			const csrftoken = Cookies.get('csrftoken');
			const url = `/api/kubex/status?kubex=${sn}`;
			$.ajax({
				url: url,
				type: 'get',
				headers: {
					"X-CSRFToken": csrftoken,
				},
				success: (res) => {
					console.log('kubex config info ->', res);
					$('#kubeConfigModal span#kubex-ip').html(res.kubex_IP);
					$('#kubeConfigModal span#server-ip').html(res.server_IP);
					const _ul = $('ul#sensor-list').get(0);
					Object.keys(res.sensors).forEach((sensorId) => {
						const _li = $.parseHTML(`<li>Sensor ${sensorId}: ${res.sensors[sensorId]}</li>`)[0];
						_ul.appendChild(_li);
					});
					$('#kubeConfigModal').modal();
				},
			});
		}
	}

const editSensorConfiguration = (event) => {
	const sn = $(event.target).closest(".panel-primary").children(".panel-body").children("span[name='sn']").html();
	const sid = $(event.target).closest("div.pull-right").attr("data-sid");
	if(sn && sid) {
		$('#sensorConfigModal').attr('data-sn', sn);
		$('#sensorConfigModal').attr('data-sid', sid);
		const csrftoken = Cookies.get('csrftoken');
		const url = `/api/kubex/status?kubex=${sn}&sensor=${sid}`;
		$.ajax({
			url: url,
			type: 'get',
			headers: {
				"X-CSRFToken": csrftoken,
			},
			success: (res) => {
				console.log('sensor config info ->', res);
				$('#sensorConfigModal span#sensor-id').html(res.sensor_id);
				$('#sensorConfigModal span#data-format').html(DATA_FORMAT_MAP[res.data_format]);
				$('#sensorConfigModal input#sensor-title').val(res.title);
				$('#sensorConfigModal input#sensor-description').val(res.description);
				$('#sensorConfigModal input#sensor-ip').val(res.sensor_IP);

				const fieldBlock = $('#sensorConfigModal div#sensor-fields').get(0);
				$(fieldBlock).html(null);
				res.fields.forEach((field, idx) => {
					const blockLabel = $.parseHTML(`<h4 style='float:right';><b>Field ${idx}</b></h4>`)[0];
					const _container = $.parseHTML('<div class="field-block" style="margin-top:20px;"></div>')[0];
					const dataNatureLabel = $.parseHTML(`<label for='${idx}-data-nature'>Data Nature:</label>`)[0];
					const dataNatureInput = $.parseHTML(`<input class='form-control' id='${idx}-data-nature' value=${field.data_nature} />`)[0];
					const titleLabel = $.parseHTML(`<label for='${idx}-title'>Title:</label>`)[0];
					const titleInput = $.parseHTML(`<input class='form-control' id='${idx}-title' value=${field.title} />`)[0];
					const unitLabel = $.parseHTML(`<label for='${idx}-unit'>Unit:</label>`)[0];
					const unitInput = $.parseHTML(`<input class='form-control' id='${idx}-unit' value=${field.unit} />`)[0];

					const dataTypeSelect = $.parseHTML(`<select id='${idx}-data-type' value=${field.data_type} class="form-control" ></select>`)[0];
					const dataTypeLabel = $.parseHTML(`<label for='${idx}-data-type'>Data Type:</label>`)[0];
					ALLOWED_DATATYPE_MAP[res.data_format].forEach(dataType => {
						const _option = dataType === field.data_type ? $.parseHTML(`<option value=${dataType} selected >${dataType}</option>`)[0]: $.parseHTML(`<option value=${dataType}>${dataType}</option>`)[0];
						dataTypeSelect.appendChild(_option);
					});
					_container.appendChild(blockLabel);
					_container.appendChild(titleLabel);
					_container.appendChild(titleInput);	
					_container.appendChild(dataNatureLabel);
					_container.appendChild(dataNatureInput);
					_container.appendChild(unitLabel);
					_container.appendChild(unitInput);
					_container.appendChild(dataTypeLabel);
					_container.appendChild(dataTypeSelect);
					fieldBlock.appendChild(_container);
				});
				$('#sensorConfigModal').modal();
			},
		});
	}
}

const updateSensor = (event) => {
	const requestBody = {};
	requestBody.kubex = $(event.target).closest('#sensorConfigModal').attr('data-sn');
	requestBody.sensor = $(event.target).closest('#sensorConfigModal').attr('data-sid');
	requestBody.config = {};
	requestBody.config.fields = [];

	const modalBody = $(event.target).closest('.modal-content').children('.modal-body');
	requestBody.config.title = modalBody.children('#sensor-title').val();
	requestBody.config.description = modalBody.children('#sensor-description').val();
	requestBody.config.sensor_IP = modalBody.children('#sensor-ip').val();
	requestBody.config.sensor_id = modalBody.children('#sensor-id').html();
	requestBody.config.kubex_SN = $(event.target).closest('#sensorConfigModal').attr('data-sn');
	$('#sensor-fields .field-block').get().forEach((field, idx) => {
		const obj = {};
		obj.data_nature = $(field).children(`#${idx}-data-nature`).val();
		obj.data_type = $(field).children(`#${idx}-data-type`).val();
		obj.title = $(field).children(`#${idx}-title`).val();
		obj.unit = $(field).children(`#${idx}-unit`).val();
		requestBody.config.fields.push(obj);
	});

	console.log('to send --> ', requestBody);
	const url = 'api/kubex/config';
	const csrftoken = Cookies.get('csrftoken');
	$.ajax({
		url: url,
		type: 'post',
		data: JSON.stringify(requestBody),
		headers: {
			"X-CSRFToken": csrftoken,
			"Content-Type": 'application/json',
		},
		success: (res) => {
			responseMsg('#alert_container', { status: 200, message: res.msg });
		},
		error: (err) => {
			console.log(err.body);
			responseMsg('#alert_container', err);
		}
	});

} 
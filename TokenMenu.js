
// deprecated. replaced by mytokens
tokendata={
	folders:{},
};

// deprecated, but still needed for migrate_to_my_tokens() to work
function convert_path(path){
	var pieces=path.split("/");
	var current=tokendata;

	for(let i=0;i<pieces.length;i++){
		if(!current || pieces[i]=="")
			continue;
		current=current.folders[pieces[i]];
	}
	return current || {};
}

// deprecated, but still needed for migrate_to_my_tokens() to work
function persist_customtokens(){
	console.warn("persist_customtokens no longer supported");
	// delete tokendata.folders["AboveVTT BUILTIN"];
	// localStorage.setItem("CustomTokens",JSON.stringify(tokendata));
	// delete tokendata.folders["AboveVTT BUILTIN"];
}

function context_menu_flyout(id, hoverEvent, buildFunction) {
	let contextMenu = $("#tokenOptionsPopup");
	if (contextMenu.length === 0) {
		console.warn("context_menu_flyout, but #tokenOptionsPopup could not be found");
		return;
	}

	if (hoverEvent.type === "mouseenter") {
		let flyout = $(`<div id='${id}' class='context-menu-flyout'></div>`);
		$(`.context-menu-flyout`).remove(); // never duplicate

		buildFunction(flyout);
		$("#tokenOptionsContainer").append(flyout);
		observe_hover_text(flyout);

		let contextMenuCenter = (contextMenu.height() / 2);
		let flyoutHeight = flyout.height();
		let diff = (contextMenu.height() - flyoutHeight);
		let flyoutTop = contextMenuCenter - (flyoutHeight / 2); // center alongside the contextmenu


		if (diff > 0) {
			// the flyout is smaller than the contextmenu. Make sure it's alongside the hovered row			
			// align to the top of the row. 14 is half the height of the button
			let buttonPosition = $(".flyout-from-menu-item:hover")[0].getBoundingClientRect().y - $("#tokenOptionsPopup")[0].getBoundingClientRect().y + 14
			if(buttonPosition < contextMenuCenter) {
				flyoutTop =  buttonPosition - (flyoutHeight / 5)
			}
			else{
				flyoutTop =  buttonPosition - (flyoutHeight / 2)
			}				
		}	

		flyout.css({
			left: contextMenu.width(),
			top: flyoutTop,
		});

		if ($(".context-menu-flyout")[0].getBoundingClientRect().top < 0) {
			flyout.css("top", 0)
		}
		else if($(".context-menu-flyout")[0].getBoundingClientRect().bottom > window.innerHeight-15) {
			flyout.css({
				top: 'unset',
				bottom: 0
			});
		}
		
	} 
}

function close_token_context_menu() {
	$("#tokenOptionsClickCloseDiv").click();
}

/**
 * Opens a sidebar modal with token configuration options
 * @param tokenIds {Array<String>} an array of ids for the tokens being configured
 */
function token_context_menu_expanded(tokenIds, e) {
	if (tokenIds === undefined || tokenIds.length === 0) {
		console.warn(`token_context_menu_expanded was called without any token ids`);
		return;
	}

	let tokens = tokenIds.map(id => window.TOKEN_OBJECTS[id]).filter(t => t !== undefined)

	if (tokens.length === 0) {
		console.warn(`token_context_menu_expanded was called with ids: ${JSON.stringify(tokenIds)}, but no matching tokens could be found`);
		return;
	}

	// Aoe tokens are treated differently from everything else so we need to check this more often
	let isAoeList = tokens.map(t => t.isAoe());
	let uniqueAoeList = [...new Set(isAoeList)];
	const allTokensAreAoe = (uniqueAoeList.length === 1 && uniqueAoeList[0] === true);
	const someTokensAreAoe = (uniqueAoeList.includes(true));

	$("#tokenOptionsPopup").remove();
	let tokenOptionsClickCloseDiv = $("<div id='tokenOptionsClickCloseDiv'></div>");
	tokenOptionsClickCloseDiv.off().on("click", function(){
		$("#tokenOptionsPopup").remove();
		$('.context-menu-list').trigger('contextmenu:hide')
		tokenOptionsClickCloseDiv.remove();
		$("#tokenOptionsContainer .sp-container").spectrum("destroy");
		$("#tokenOptionsContainer .sp-container").remove();
		$(`.context-menu-flyout`).remove(); 
	});

	let moveableTokenOptions = $("<div id='tokenOptionsPopup'></div>");

	
	let body = $("<div id='tokenOptionsContainer'></div>");
	moveableTokenOptions.append(body);

	$('body').append(moveableTokenOptions);
	$('body').append(tokenOptionsClickCloseDiv);

	// stat block / character sheet


	if (tokens.length === 1) {
		let token = tokens[0];
		if (token.isPlayer() && !token.options.id.includes(window.PLAYER_ID)) {
			let button = $(`<button>Open Character Sheet<span class="material-icons icon-view"></span></button>`);
			button.on("click", function() {
				open_player_sheet(token.options.id);
				close_token_context_menu();
			});
			body.append(button);
		} 
		else if(token.options.statBlock){
			let button =$('<button>Open Monster Stat Block<span class="material-icons icon-view"></span></button>');
			
			button.click(function(){
				let customStatBlock = window.JOURNAL.notes[token.options.statBlock].text;
				let pcURL = $(customStatBlock).find('.custom-pc-sheet.custom-stat').text();
				if(pcURL){
					open_player_sheet(pcURL);
				}else{
					load_monster_stat(undefined, token.options.id, customStatBlock)
				}

				
				close_token_context_menu();
			});
			if(token.options.player_owned || window.DM){
				body.append(button);
			}
		}
		else if (token.isMonster()) {
			let button = $(`<button>Open Monster Stat Block<span class="material-icons icon-view"></span></button>`);
			button.on("click", function() {
				load_monster_stat(token.options.monster, token.options.id);
				close_token_context_menu();
			});
			if(token.options.player_owned || window.DM){
				body.append(button);
			}
		}
	}


	if (window.DM && !allTokensAreAoe) {
		let addButtonInternals = `Add to Combat Tracker<span class="material-icons icon-person-add"></span>`;
		let removeButtonInternals = `Remove From Combat Tracker<span class="material-icons icon-person-remove"></span>`;
		let combatButton = $(`<button></button>`);
		let inCombatStatuses = [...new Set(tokens.map(t => t.isInCombatTracker()))];
		if (inCombatStatuses.length === 1 && inCombatStatuses[0] === true) {
			// they are all in the combat tracker. Make it a remove button
			combatButton.addClass("remove-from-ct");
			combatButton.html(removeButtonInternals);
		} else {
			// if any are not in the combat tracker, make it an add button.
			combatButton.addClass("add-to-ct");
			combatButton.html(addButtonInternals);
		}
		combatButton.on("click", function(clickEvent) {
			let clickedButton = $(clickEvent.currentTarget);
			if (clickedButton.hasClass("remove-from-ct")) {
				clickedButton.removeClass("remove-from-ct").addClass("add-to-ct");
				clickedButton.html(addButtonInternals);
				tokens.forEach(t =>{
					t.options.ct_show = undefined;
					ct_remove_token(t, false);
					t.update_and_sync();
				});
			} else {
				clickedButton.removeClass("add-to-ct").addClass("remove-from-ct");
				clickedButton.html(removeButtonInternals);
				tokens.forEach(t => {
					ct_add_token(t, false)
					t.update_and_sync();
				});
			}

			debounceCombatReorder();
		});
		
		body.append(combatButton);

		let hideText = tokenIds.length > 1 ? "Hide Tokens" : "Hide Token"
		let hiddenMenuButton = $(`<button class="${determine_hidden_classname(tokenIds)} context-menu-icon-hidden icon-invisible material-icons">${hideText}</button>`)
		hiddenMenuButton.off().on("click", function(clickEvent){
			let clickedItem = $(this);
			let hideAll = clickedItem.hasClass("some-active");
			tokens.forEach(token => {
				if (hideAll || token.options.hidden !== true) {
					token.hide();
				} else {
					token.show();
				}
			});

			clickedItem.removeClass("single-active all-active some-active active-condition");
			clickedItem.addClass(determine_hidden_classname(tokenIds));
		});
		body.append(hiddenMenuButton);
	}

	if (tokens.length > 1 || (tokens.length == 1 && tokens[0].options.groupId != undefined)) {
		let addButtonInternals = `Group Tokens<span class="material-icons add-link"></span>`;
		let removeButtonInternals = `Remove From Group<span class="material-icons link-off"></span>`;
		let groupTokens = $(`<button class='${determine_grouped_classname(tokenIds)} context-menu-icon-grouped material-icons'></button>`);
		if (groupTokens.hasClass('single-active')) {
			// they are all in a group. Make it a remove button
			groupTokens.addClass("remove-from-group");
			groupTokens.html(removeButtonInternals);
		} else {
			// if any are not in the combat tracker, make it an add button.
			groupTokens.addClass("add-to-group");
			groupTokens.html(addButtonInternals);
		}
		groupTokens.off().on("click", function(clickEvent){
			let clickedItem = $(this);
			let groupAll = clickedItem.hasClass("some-active");
			let group = uuid();
			tokens.forEach(token => {
				if (groupAll || clickedItem.hasClass('add-to-group')) {
					token.options.groupId = group;
				} else {
					token.options.groupId = undefined;
				}
				token.place_sync_persist();
			});
			clickedItem.removeClass("single-active all-active some-active active-condition");
			clickedItem.addClass(determine_grouped_classname(tokenIds));
		});
		body.append(groupTokens);
	}

	// Start Quick Group Roll
	if (window.DM) {
		let quickRollMenu = $("<button class='material-icons open-menu'>Add/Remove from Quick Rolls</button>")
		body.append(quickRollMenu);
		quickRollMenu.on("click", function(clickEvent){
			$("#qrm_dialog").show()
			if ($('#quick_roll_area').length == 0){
				close_token_context_menu()
				open_quick_roll_menu(e)
			}
			tokens.forEach(token => {
				$(token).each(function(){
					if (window.TOKEN_OBJECTS[token.options.id].in_qrm == true) {
						remove_from_quick_roll_menu(token)
					}
					else {
						add_to_quick_roll_menu(token)
					}
				})
			})
			if(childWindows['Quick Roll Menu']){
				qrm_update_popout();
			}
		})
	}
	// End Quick Group Roll 
	let toTopMenuButton = $("<button class='material-icons to-top'>Move to Top</button>");
	let toBottomMenuButton = $("<button class='material-icons to-bottom'>Move to Bottom</button>")

	if(window.DM || (tokens.length == 1 && (tokens[0].isPlayer() || (tokens[0].options.player_owned && !tokens[0].isPlayer())))) {
		body.append(toTopMenuButton);
		body.append(toBottomMenuButton);

		toTopMenuButton.off().on("click", function(tokenIds){
			tokens.forEach(token => {
				$(".token").each(function(){	
					let tokenId = $(this).attr('data-id');	
					let tokenzindexdiff = window.TOKEN_OBJECTS[tokenId].options.zindexdiff;
					if (tokenzindexdiff >= window.TOKEN_OBJECTS[token.options.id].options.zindexdiff && tokenId != token.options.id) {
						window.TOKEN_OBJECTS[token.options.id].options.zindexdiff = tokenzindexdiff + 1;
					}		
				});
				token.place_sync_persist();
			});
		});

		toBottomMenuButton.off().on("click", function(tokenIds){
			tokens.forEach(token => {			
				$(".token").each(function(){	
					let tokenId = $(this).attr('data-id');	
					let tokenzindexdiff = window.TOKEN_OBJECTS[tokenId].options.zindexdiff;
					if (tokenzindexdiff <= window.TOKEN_OBJECTS[token.options.id].options.zindexdiff && tokenId != token.options.id) {
						window.TOKEN_OBJECTS[token.options.id].options.zindexdiff = Math.max(tokenzindexdiff - 1, -5000);
					}		
				});
				token.place_sync_persist();
			});
		});
	}

	if (tokens.length === 1) {
		body.append(build_menu_stat_inputs(tokenIds));
		$(".hpMenuInput").on('focus', function(event){
			event.target.select();
		});
		$(".maxHpMenuInput").on('focus', function(event){
			event.target.select();
		});
		$(".acMenuInput").on('focus', function(event){
				event.target.select();
		});
		$(".elevMenuInput").on('focus', function(event){
				event.target.select();
		});
	}

	if(tokens.length == 1 && ((tokens[0].options.player_owned && !tokens[0].options.disablestat && !tokens[0].isPlayer()) || (window.DM && !tokens[0].isPlayer()))){ 
		$(".maxHpMenuInput").prop('disabled', false);
		$(".acMenuInput").prop('disabled', false);
		$(".hpMenuInput").prop('disabled', false);
	}
	else { 
		$(".maxHpMenuInput").prop('disabled', true);
		$(".acMenuInput").prop('disabled', true);
		$(".hpMenuInput").prop('disabled', true);
	}	
	let conditionsRow = $(`<div class="token-image-modal-footer-select-wrapper flyout-from-menu-item"><div class="token-image-modal-footer-title">Conditions / Markers</div></div>`);	
	conditionsRow.hover(function (hoverEvent) {
		context_menu_flyout("conditions-flyout", hoverEvent, function(flyout) {
			flyout.append(build_conditions_and_markers_flyout_menu(tokenIds));
		})
	});

	body.append(conditionsRow);
	let adjustmentsRow = $(`<div class="token-image-modal-footer-select-wrapper flyout-from-menu-item"><div class="token-image-modal-footer-title">Token Adjustments</div></div>`);
	adjustmentsRow.hover(function (hoverEvent) {
		context_menu_flyout("adjustments-flyout", hoverEvent, function(flyout) {
			flyout.append(build_adjustments_flyout_menu(tokenIds));
		})
	});
	if(window.DM || (tokens.length == 1 && (tokens[0].options.player_owned == true || tokens[0].isPlayer()))){
		body.append(adjustmentsRow);
	}

	// Auras (torch, lantern, etc)
	let aurasRow = $(`<div class="token-image-modal-footer-select-wrapper flyout-from-menu-item"><div class="token-image-modal-footer-title">Token Auras</div></div>`);
	aurasRow.hover(function (hoverEvent) {
		context_menu_flyout("auras-flyout", hoverEvent, function(flyout) {
			flyout.append(build_token_auras_inputs(tokenIds));
		})
	});
	if(window.DM || (tokens.length == 1 && (tokens[0].options.player_owned == true || tokens[0].isPlayer()))){
		if (!someTokensAreAoe) {
			body.append(aurasRow);
		}
	}
	let lightRow = $(`<div class="token-image-modal-footer-select-wrapper flyout-from-menu-item"><div class="token-image-modal-footer-title">Token Vision/Light</div></div>`);
	lightRow.hover(function (hoverEvent) {
		context_menu_flyout("light-flyout", hoverEvent, function(flyout) {
			flyout.append(build_token_light_inputs(tokenIds));
		})
	});
	if(window.CURRENT_SCENE_DATA.disableSceneVision != true && (window.DM || (tokens.length == 1 && (tokens[0].options.player_owned == true || tokens[0].isPlayer())))){
		if (!someTokensAreAoe) {
			body.append(lightRow);
		}
	}
	if(window.DM) {
		if (tokens.length === 1) {
			let notesRow = $(`<div class="token-image-modal-footer-select-wrapper flyout-from-menu-item"><div class="token-image-modal-footer-title">Token Note</div></div>`);
			notesRow.hover(function (hoverEvent) {
				context_menu_flyout("notes-flyout", hoverEvent, function(flyout) {
					flyout.append(build_notes_flyout_menu(tokenIds));
				})
			});
			body.append(notesRow);
		}
	}

	if(window.DM) {
		let optionsRow = $(`<div class="token-image-modal-footer-select-wrapper flyout-from-menu-item"><div class="token-image-modal-footer-title">Token Options</div></div>`);
		optionsRow.hover(function (hoverEvent) {
			context_menu_flyout("options-flyout", hoverEvent, function(flyout) {
				flyout.append(build_options_flyout_menu(tokenIds));
				update_token_base_visibility(flyout);
			});
		});
		body.append(optionsRow);
	}

	if(window.DM) {
		body.append(`<hr style="opacity: 0.3" />`);
		let deleteTokenMenuButton = $("<button class='deleteMenuButton icon-close-red material-icons'>Delete</button>")
	 	body.append(deleteTokenMenuButton);
	 	deleteTokenMenuButton.off().on("click", function(){
	 		if(!$(e.target).hasClass("tokenselected")){
	 			deselect_all_tokens();
	 		}
	 		tokens.forEach(token => {
	 			token.selected = true;
	 		});
			delete_selected_tokens();
			close_token_context_menu();
	 	});
	 }


	$("#tokenOptionsPopup").addClass("moveableWindow");
	$("#tokenOptionsPopup").draggable({
			addClasses: false,
			scroll: false,
			containment: "#windowContainment",
			start: function () {
				$("#resizeDragMon").append($('<div class="iframeResizeCover"></div>'));			
				$("#sheet").append($('<div class="iframeResizeCover"></div>'));
			},
			stop: function () {
				$('.iframeResizeCover').remove();

			}
		});
	

	moveableTokenOptions.css("left", Math.max(e.clientX - 230, 0) + 'px');

	if($(moveableTokenOptions).height() + e.clientY > window.innerHeight - 20) {
		moveableTokenOptions.css("top", (window.innerHeight - $(moveableTokenOptions).height() - 20 + 'px'));
	}
	else {
		moveableTokenOptions.css("top", e.clientY - 10 + 'px');
	}	
}


/**
 * Builds and returns HTML inputs for updating token auras
 * @param tokens {Array<Token>} the token objects that the aura configuration HTML is for
 * @returns {*|jQuery|HTMLElement}
 */
function build_token_auras_inputs(tokenIds) {
	let tokens = tokenIds.map(id => window.TOKEN_OBJECTS[id]).filter(t => t !== undefined);
	let body = $("<div></div>");
	body.css({
		width: "290px", // once we add Markers, make this wide enough to contain them all
		padding: "5px",
		display: "flex",
		"flex-direction": "row"
	})

	let allTokensArePlayer = true;
	for(let token in tokens){
		if(!window.TOKEN_OBJECTS[tokens[token].options.id].isPlayer()){
			allTokensArePlayer=false;
			break;
		}
	}

	let auraVisibleValues = tokens.map(t => t.options.auraVisible);
	let uniqueAuraVisibleValues = [...new Set(auraVisibleValues)];

	

	let auraIsEnabled = null;
	if (uniqueAuraVisibleValues.length === 1) {
		auraIsEnabled = uniqueAuraVisibleValues[0];
	}

	let hideAuraFromPlayers = tokens.map(t => t.options.hideaura);
	let uniqueHideAuraFromPlayers = [...new Set(hideAuraFromPlayers)];
	
	let hideAuraIsEnabled = null;
	if (uniqueHideAuraFromPlayers.length === 1) {
		hideAuraIsEnabled = uniqueHideAuraFromPlayers[0];
	}

	let aura1Feet = tokens.map(t => t.options.aura1.feet);
	let uniqueAura1Feet = aura1Feet.length === 1 ? aura1Feet[0] : ""
	let aura2Feet = tokens.map(t => t.options.aura2.feet);
	let uniqueAura2Feet = aura2Feet.length === 1 ? aura2Feet[0] : ""
	let aura1Color = tokens.map(t => t.options.aura1.color);
	let uniqueAura1Color = aura1Color.length === 1 ? aura1Color[0] : ""
	let aura2Color = tokens.map(t => t.options.aura2.color);
	let uniqueAura2Color = aura2Color.length === 1 ? aura2Color[0] : ""

	let upsq = 'ft';
	if (window.CURRENT_SCENE_DATA.upsq !== undefined && window.CURRENT_SCENE_DATA.upsq.length > 0) {
		upsq = window.CURRENT_SCENE_DATA.upsq;
	}
	let wrapper = $(`
		<div class="token-config-aura-input">

			<div class="token-config-aura-wrapper">
				<div class="token-image-modal-footer-select-wrapper">
				</div>
				<div class="menu-inner-aura">
					<h3 style="margin-bottom:0px;">Inner Aura</h3>
					<div class="token-image-modal-footer-select-wrapper" style="padding-left: 2px">
						<div class="token-image-modal-footer-title">Radius (${upsq})</div>
						<input class="aura-radius" name="aura1" type="text" value="${uniqueAura1Feet}" style="width: 3rem" />
					</div>
					<div class="token-image-modal-footer-select-wrapper" style="padding-left: 2px">
						<div class="token-image-modal-footer-title">Color</div>
						<input class="spectrum" name="aura1Color" value="${uniqueAura1Color}" >
					</div>
				</div>
				<div class="menu-outer-aura">
					<h3 style="margin-bottom:0px;">Outer Aura</h3>
					<div class="token-image-modal-footer-select-wrapper" style="padding-left: 2px">
						<div class="token-image-modal-footer-title">Radius (${upsq})</div>
						<input class="aura-radius" name="aura2" type="text" value="${uniqueAura2Feet}" style="width: 3rem" />
					</div>
					<div class="token-image-modal-footer-select-wrapper" style="padding-left: 2px">
						<div class="token-image-modal-footer-title">Color</div>
						<input class="spectrum" name="aura2Color" value="${uniqueAura1Color}" >
					</div>
				</div>
			</div>
		</div>
	`);

	const auraOption = {
		name: "auraVisible",
		label: "Enable Token Auras",
		type: "toggle",
		options: [
			{ value: true, label: "Visible", description: "Token Auras are visible." },
			{ value: false, label: "Hidden", description: "Token Auras are hidden." }
		],
		defaultValue: false
	};
	let enabledAurasInput = build_toggle_input(auraOption, auraIsEnabled, function(name, newValue) {
		console.log(`${name} setting is now ${newValue}`);
		tokens.forEach(token => {
			token.options[name] = newValue;
			token.place_sync_persist();
		});
		if (newValue) {
			wrapper.find(".token-config-aura-wrapper").show();
		} else {
			wrapper.find(".token-config-aura-wrapper").hide();
		}
	});
	wrapper.prepend(enabledAurasInput);	
	
	wrapper.find("h3.token-image-modal-footer-title").after(enabledAurasInput);
	if (auraIsEnabled) {
		wrapper.find(".token-config-aura-wrapper").show();
	} else {
		wrapper.find(".token-config-aura-wrapper").hide();
	}
	const hideAuraLabel = (allTokensArePlayer) ? 'Hide Aura from other Players' : 'Hide Aura from Players';
	const hideAura = {
		name: "hideaura",
		label: hideAuraLabel,
		type: "toggle",
		options: [
			{ value: true, label: "Hidden", description: "The token's aura is hidden from players." },
			{ value: false, label: "Visible", description: "The token's aura is visible to players." }
		],
		defaultValue: false
	};
	const hideAuraInput = build_toggle_input(hideAura, hideAuraIsEnabled, function(name, newValue) {
		console.log(`${name} setting is now ${newValue}`);
		tokens.forEach(token => {
			token.options[name] = newValue;
			token.place_sync_persist();
		});
	});
	if(window.DM || (tokens.length == 1 && (window.TOKEN_OBJECTS[tokens[0].options.id].options.player_owned || allTokensArePlayer))){
		wrapper.find(".token-config-aura-wrapper").prepend(hideAuraInput);
	}
	let radiusInputs = wrapper.find('input.aura-radius');
	radiusInputs.on('keyup', function(event) {
		let newRadius = event.target.value;
		if (event.key == "Enter" && newRadius !== undefined && newRadius.length > 0) {
			tokens.forEach(token => {
				token.options[event.target.name]['feet'] = newRadius;
				token.place_sync_persist();
			});
			$(event.target).closest(".token-config-aura-wrapper").find(".token-config-aura-preset")[0].selectedIndex = 0;
		}
	});
	radiusInputs.on('focusout', function(event) {
		let newRadius = event.target.value;
		if (newRadius !== undefined && newRadius.length > 0) {
			tokens.forEach(token => {
				token.options[event.target.name]['feet'] = newRadius;
				token.place_sync_persist();
			});
			$(event.target).closest(".token-config-aura-wrapper").find(".token-config-aura-preset")[0].selectedIndex = 0;
		}
	});

	let colorPickers = wrapper.find('input.spectrum');
	colorPickers.spectrum({
		type: "color",
		showInput: true,
		showInitial: true,
		containerClassName: 'prevent-sidebar-modal-close',
		clickoutFiresChange: true,
		appendTo: "parent"
	});
	wrapper.find("input[name='aura1Color']").spectrum("set", uniqueAura1Color);
	wrapper.find("input[name='aura2Color']").spectrum("set", uniqueAura2Color);
	const colorPickerChange = function(e, tinycolor) {
		let auraName = e.target.name.replace("Color", "");
		let color = `rgba(${tinycolor._r}, ${tinycolor._g}, ${tinycolor._b}, ${tinycolor._a})`;
		console.log(auraName, e, tinycolor);
		if (e.type === 'change') {
			tokens.forEach(token => {
				token.options[auraName]['color'] = color;
				token.place_sync_persist();
			});
		} else {
			tokens.forEach(token => {
				let selector = "div[data-id='" + token.options.id + "']";
				let html = $("#tokens").find(selector);
				let options = Object.assign({}, token.options);
				options[auraName]['color'] = color;
				setTokenAuras(html, token.options)
			});
		}
	};
	colorPickers.on('move.spectrum', colorPickerChange);   // update the token as the player messes around with colors
	colorPickers.on('change.spectrum', colorPickerChange); // commit the changes when the user clicks the submit button
	colorPickers.on('hide.spectrum', colorPickerChange);   // the hide event includes the original color so let's change it back when we get it


	wrapper.find(".token-config-aura-preset").on("change", function(e) {
		let feet1 = "";
		let feet2 = "";
		let preset = e.target.value;
		if (preset === "candle") {
			feet1 = "5";
			feet2 = "5";
		} else if (preset === "torch") {
			feet1 = "20";
			feet2 = "20";
		} else if (preset === "lamp") {
			feet1 = "15";
			feet2 = "30";
		} else if (preset === "lantern") {
			feet1 = "30";
			feet2 = "30";
		} else {
			console.warn("somehow got an unexpected preset", preset, e);
		}
		let wrapper = $(e.target).closest(".token-config-aura-wrapper");
		wrapper.find("input[name='aura1']").val(feet1);
		wrapper.find("input[name='aura2']").val(feet2);

		let color1 = "rgba(255, 129, 0, 0.3)";
		let color2 = "rgba(255, 255, 0, 0.1)";
		wrapper.find("input[name='aura1Color']").spectrum("set", color1);
		wrapper.find("input[name='aura2Color']").spectrum("set", color2);

		tokens.forEach(token => {
			token.options.aura1.feet = feet1;
			token.options.aura2.feet = feet2;
			token.options.aura1.color = color1;
			token.options.aura2.color = color2;
			token.place_sync_persist();
		});
	});

	$("#VTTWRAPPER .sidebar-modal").on("remove", function () {
		console.log("removing sidebar modal!!!");
		colorPickers.spectrum("destroy");
	});
	body.append(wrapper);

	return body;
}
/**
 * Builds and returns HTML inputs for updating token auras
 * @param tokens {Array<Token>} the token objects that the aura configuration HTML is for
 * @returns {*|jQuery|HTMLElement}
 */
function build_token_light_inputs(tokenIds) {
	let tokens = tokenIds.map(id => window.TOKEN_OBJECTS[id]).filter(t => t !== undefined);
	let body = $("<div></div>");
	body.css({
		width: "290px", // once we add Markers, make this wide enough to contain them all
		padding: "5px",
		display: "flex",
		"flex-direction": "row"
	})

	let allTokensArePlayer = true;
	for(let token in tokens){
		if(!window.TOKEN_OBJECTS[tokens[token].options.id].isPlayer()){
			allTokensArePlayer=false;
			break;
		}
	}


	let auraLightValues = tokens.map(t => t.options.auraislight);
	let uniqueAuraLightValues = [...new Set(auraLightValues)];

	let auraRevealVisionValues = tokens.map(t => t.options.share_vision);
	let uniqueAuraRevealVisionValues = [...new Set(auraRevealVisionValues)];

	let auraIsLightEnabled = null;
	if (uniqueAuraLightValues.length === 1) {
		auraIsLightEnabled = uniqueAuraLightValues[0];
	}



	let auraRevealVisionEnabled = null;
	if (uniqueAuraRevealVisionValues.length === 1) {
		auraRevealVisionEnabled = uniqueAuraRevealVisionValues[0];
	}

	let aura1Feet = tokens.map(t => t.options.light1.feet);
	let uniqueAura1Feet = aura1Feet.length === 1 ? aura1Feet[0] : ""
	let aura2Feet = tokens.map(t => t.options.light2.feet);
	let uniqueAura2Feet = aura2Feet.length === 1 ? aura2Feet[0] : ""
	let aura1Color = tokens.map(t => t.options.light1.color);
	let uniqueAura1Color = aura1Color.length === 1 ? aura1Color[0] : ""
	let aura2Color = tokens.map(t => t.options.light2.color);
	let uniqueAura2Color = aura2Color.length === 1 ? aura2Color[0] : ""
	let visionFeet = tokens.map(t => t.options.vision.feet);
	let uniqueVisionFeet = visionFeet.length === 1 ? visionFeet[0] : ""
	let visionColor = tokens.map(t => t.options.vision.color);
	let uniqueVisionColor = visionColor.length === 1 ? visionColor[0] : ""

	let upsq = 'ft';
	if (window.CURRENT_SCENE_DATA.upsq !== undefined && window.CURRENT_SCENE_DATA.upsq.length > 0) {
		upsq = window.CURRENT_SCENE_DATA.upsq;
	}
	let wrapper = $(`
		<div class="token-config-aura-input">

			<div class="token-config-aura-wrapper">
				<div class="token-image-modal-footer-select-wrapper">
					
				
				<div class="token-image-modal-footer-title">Preset</div>
					<select class="token-config-aura-preset">
						<option value="none"></option>
						<option value="candle">Candle (5/5)</option>
						<option value="torch">Torch / Light (20/20)</option>
						<option value="lamp">Lamp (15/30)</option>
						<option value="lantern">Lantern (30/30)</option>
					</select>
				</div>
				<div class="menu-vision-aura">
					<h3 style="margin-bottom:0px;">Darkvision</h3>
					<div class="token-image-modal-footer-select-wrapper" style="padding-left: 2px">
						<div class="token-image-modal-footer-title">Radius (${upsq})</div>
						<input class="vision-radius" name="vision" type="text" value="${uniqueVisionFeet}" style="width: 3rem" />
					</div>
					<div class="token-image-modal-footer-select-wrapper" style="padding-left: 2px">
						<div class="token-image-modal-footer-title">Color</div>
						<input class="spectrum" name="visionColor" value="${uniqueVisionColor}" >
					</div>
				</div>
				<div class="menu-inner-aura">
					<h3 style="margin-bottom:0px;">Inner Light</h3>
					<div class="token-image-modal-footer-select-wrapper" style="padding-left: 2px">
						<div class="token-image-modal-footer-title">Radius (${upsq})</div>
						<input class="light-radius" name="light1" type="text" value="${uniqueAura1Feet}" style="width: 3rem" />
					</div>
					<div class="token-image-modal-footer-select-wrapper" style="padding-left: 2px">
						<div class="token-image-modal-footer-title">Color</div>
						<input class="spectrum" name="light1Color" value="${uniqueAura1Color}" >
					</div>
				</div>
				<div class="menu-outer-aura">
					<h3 style="margin-bottom:0px;">Outer Light</h3>
					<div class="token-image-modal-footer-select-wrapper" style="padding-left: 2px">
						<div class="token-image-modal-footer-title">Radius (${upsq})</div>
						<input class="light-radius" name="light2" type="text" value="${uniqueAura2Feet}" style="width: 3rem" />
					</div>
					<div class="token-image-modal-footer-select-wrapper" style="padding-left: 2px">
						<div class="token-image-modal-footer-title">Color</div>
						<input class="spectrum" name="light2Color" value="${uniqueAura1Color}" >
					</div>
				</div>
			</div>
		</div>
	`);

	const lightOption = {
		name: "auraislight",
		label: "Enable Token Vision/Light",
		type: "toggle",
		options: [
			{ value: true, label: "Enable", description: "Token has light/vision." },
			{ value: false, label: "Disable", description: "Token has no light/vision." }
		],
		defaultValue: false
	};
	let enabledLightInput = build_toggle_input( lightOption, auraIsLightEnabled, function(name, newValue) {
		console.log(`${name} setting is now ${newValue}`);
		tokens.forEach(token => {
			token.options[name] = newValue;
			token.place_sync_persist();
		});
		if (newValue) {
			wrapper.find(".token-config-aura-wrapper").show();
		} else {
			wrapper.find(".token-config-aura-wrapper").hide();
		}
	});

	const revealvisionOption = {
		name: "share_vision",
		label: "Share vision with all players",
		type: "toggle",
		options: [
			{ value: false, label: "Disabled", description: "Token vision is not shared." },
			{ value: true, label: "Enabled", description: "Token vision is shared with all players." },
		],
		defaultValue: false
	};
	let revealVisionInput = build_toggle_input(revealvisionOption, auraRevealVisionEnabled, function(name, newValue) {
		console.log(`${name} setting is now ${newValue}`);
		tokens.forEach(token => {
			token.options[name] = newValue;
			token.place_sync_persist();
		});
	});

	wrapper.prepend(enabledLightInput);

	wrapper.find(".token-config-aura-wrapper").prepend(revealVisionInput);
	

	wrapper.find("h3.token-image-modal-footer-title").after(enabledLightInput);
	if (auraIsLightEnabled) {
		wrapper.find(".token-config-aura-wrapper").show();
	} else {
		wrapper.find(".token-config-aura-wrapper").hide();
	}

	let radiusInputs = wrapper.find('input.light-radius, input.vision-radius');
	radiusInputs.on('keyup', function(event) {
		let newRadius = event.target.value;
		if (event.key == "Enter" && newRadius !== undefined && newRadius.length > 0) {
			tokens.forEach(token => {
				token.options[event.target.name]['feet'] = newRadius;
				token.place_sync_persist();
			});
			$(event.target).closest(".token-config-aura-wrapper").find(".token-config-aura-preset")[0].selectedIndex = 0;
		}
	});
	radiusInputs.on('focusout', function(event) {
		let newRadius = event.target.value;
		if (newRadius !== undefined && newRadius.length > 0) {
			tokens.forEach(token => {
				token.options[event.target.name]['feet'] = newRadius;
				token.place_sync_persist();
			});
			$(event.target).closest(".token-config-aura-wrapper").find(".token-config-aura-preset")[0].selectedIndex = 0;
		}
	});

	let colorPickers = wrapper.find('input.spectrum');
	colorPickers.spectrum({
		type: "color",
		showInput: true,
		showInitial: true,
		containerClassName: 'prevent-sidebar-modal-close',
		clickoutFiresChange: true,
		appendTo: "parent"
	});
	wrapper.find("input[name='light1Color']").spectrum("set", uniqueAura1Color);
	wrapper.find("input[name='light2Color']").spectrum("set", uniqueAura2Color);
	const colorPickerChange = function(e, tinycolor) {
		let auraName = e.target.name.replace("Color", "");
		let color = `rgba(${tinycolor._r}, ${tinycolor._g}, ${tinycolor._b}, ${tinycolor._a})`;
		console.log(auraName, e, tinycolor);
		if (e.type === 'change') {
			tokens.forEach(token => {
				token.options[auraName]['color'] = color;
				token.place_sync_persist();
			});
			$(e.target).closest(".token-config-aura-wrapper").find(".token-config-aura-preset")[0].selectedIndex = 0;
		} else {
			tokens.forEach(token => {
				let selector = "div[data-id='" + token.options.id + "']";
				let html = $("#tokens").find(selector);
				let options = Object.assign({}, token.options);
				options[auraName]['color'] = color;
				setTokenAuras(html, token.options)
			});
		}
	};
	colorPickers.on('move.spectrum', colorPickerChange);   // update the token as the player messes around with colors
	colorPickers.on('change.spectrum', colorPickerChange); // commit the changes when the user clicks the submit button
	colorPickers.on('hide.spectrum', colorPickerChange);   // the hide event includes the original color so let's change it back when we get it


	wrapper.find(".token-config-aura-preset").on("change", function(e) {
		let feet1 = "";
		let feet2 = "";
		let preset = e.target.value;
		if (preset === "candle") {
			feet1 = "5";
			feet2 = "5";
		} else if (preset === "torch") {
			feet1 = "20";
			feet2 = "20";
		} else if (preset === "lamp") {
			feet1 = "15";
			feet2 = "30";
		} else if (preset === "lantern") {
			feet1 = "30";
			feet2 = "30";
		} 
		else if (preset === "60ftdark") {
			feet1 = "60";
			feet2 = "0";
		} 
		else if (preset === "120ftdark") {
			feet1 = "120";
			feet2 = "0";
		} 
		else {
			console.warn("somehow got an unexpected preset", preset, e);
		}
		let wrapper = $(e.target).closest(".token-config-aura-wrapper");
		wrapper.find("input[name='light1']").val(feet1);
		wrapper.find("input[name='light2']").val(feet2);

		let color1 = "rgba(255, 255, 255, 1)";
		let color2 = "rgba(142, 142, 142, 1)";
		wrapper.find("input[name='light1Color']").spectrum("set", color1);
		wrapper.find("input[name='light2Color']").spectrum("set", color2);

		tokens.forEach(token => {
			token.options.light1.feet = feet1;
			token.options.light2.feet = feet2;
			token.options.light1.color = color1;
			token.options.light2.color = color2;
			token.place_sync_persist();
		});
	});

	$("#VTTWRAPPER .sidebar-modal").on("remove", function () {
		console.log("removing sidebar modal!!!");
		colorPickers.spectrum("destroy");
	});
	body.append(wrapper);

	return body;
}
function build_menu_stat_inputs(tokenIds) {
	let tokens = tokenIds.map(id => window.TOKEN_OBJECTS[id]).filter(t => t !== undefined);
	let body = $("<div id='menuStatDiv'></div>");
	let hp = '';
	let max_hp = '';
	let ac = '';
	let elev = '';

	if(tokens.length == 1 && ((tokens[0].options.player_owned && !tokens[0].options.disablestat) || (!tokens[0].options.hidestat && tokens[0].isPlayer() && !tokens[0].options.disablestat) || tokens[0].options.id.includes(window.PLAYER_ID) || window.window.DM)){
		hp = tokens[0].hp;
		max_hp = tokens[0].maxHp;
		ac = tokens[0].ac;
		elev = (typeof tokens[0].options.elev !== 'undefined') ? tokens[0].options.elev : '';
	}
	else{
		hp = "????";
		max_hp = "????";
		ac = "????";
		elev = (typeof tokens[0].options.elev !== 'undefined') ? tokens[0].options.elev : '';
	}

	let hpMenuInput = $(`<label class='menu-input-label'>HP<input value='${hp}' class='menu-input hpMenuInput' type="text"></label>`);
	let maxHpMenuInput = $(`<label class='menu-input-label'>Max HP<input value='${max_hp}' class='menu-input maxHpMenuInput' type="text"></label>`);
	let acMenuInput = $(`<label class='menu-input-label'>AC<input value='${ac}' class='menu-input acMenuInput' type="text"></label>`);
	let elevMenuInput = $(`<label class='menu-input-label'>Elevation<input value='${elev}' class='menu-input elevMenuInput' type="number"></label>`);
	body.append(elevMenuInput);
	body.append(acMenuInput);
	body.append(hpMenuInput);
	body.append(maxHpMenuInput);




	hpMenuInput.on('keyup', function(event) {
		let newValue = event.target.value;
		let newHP = newValue;

		if (event.key == "Enter" && newValue !== undefined && newValue.length > 0) {
			tokens.forEach(token => {
				if(newValue.indexOf("+") == 0 || newValue.indexOf("-") == 0){
					newHP = token.hp + parseInt(newValue);
				}
				token.hp = newHP - token.tempHp;
				token.place_sync_persist();
				$(".hpMenuInput").val(newHP);
			});
		}
	});
	hpMenuInput.on('focusout', function(event) {
		let newValue = event.target.value;
		let newHP = newValue;

		tokens.forEach(token => {
			if(newValue.indexOf("+") == 0 || newValue.indexOf("-") == 0){
				newHP = token.hp + parseInt(newValue);
			}
			token.hp = newHP - token.tempHp;
			token.place_sync_persist();
			$(".hpMenuInput").val(newHP);
		});
	});

	maxHpMenuInput.on('keyup', function(event) {
		let newValue = event.target.value;
		let newMaxHP = newValue;

		if (event.key == "Enter" && newValue !== undefined && newValue.length > 0) {
			tokens.forEach(token => {
				if(newValue.indexOf("+") == 0 || newValue.indexOf("-") == 0){
					newMaxHP = token.maxHp + parseInt(newValue);
				}
				token.maxHp = newMaxHP;
				token.place_sync_persist();
				$(".maxHpMenuInput").val(newMaxHP);
			});
		}
	});
	maxHpMenuInput.on('focusout', function(event) {
		let newValue = event.target.value;
		let newMaxHP = newValue;

		tokens.forEach(token => {
			if(newValue.indexOf("+") == 0 || newValue.indexOf("-") == 0){
				newMaxHP = token.maxHp + parseInt(newValue);
			}
			token.maxHp = newMaxHP;
			token.place_sync_persist();
			$(".maxHpMenuInput").val(newMaxHP);
		});
	});

	acMenuInput.on('keyup', function(event) {
		let newValue = event.target.value;
		let newAC = newValue;

		if (event.key == "Enter" && newValue !== undefined && newValue.length > 0) {
			tokens.forEach(token => {
				if(newValue.indexOf("+") == 0 || newValue.indexOf("-") == 0){
					newAC = parseInt(token.options.ac) + parseInt(newValue);
				}
				token.ac = newAC;
				token.place_sync_persist();
				$(".acMenuInput").val(newAC);
			});
		}
	});
	acMenuInput.on('focusout', function(event) {
		let newValue = event.target.value;
		let newAC = newValue;

		tokens.forEach(token => {
			if(newValue.indexOf("+") == 0 || newValue.indexOf("-") == 0){
				newAC = parseInt(token.options.ac) + parseInt(newValue);
			}
			token.ac = newAC;
			token.place_sync_persist();
			$(".acMenuInput").val(newAC);
		});
	});

	elevMenuInput.on('keyup', function(event) {
		if (event.key == "Enter") {
			tokens.forEach(token => {
				token.options.elev = event.target.value;
				token.place_sync_persist();
			});
		}
	});
	elevMenuInput.on('focusout', function(event) {
		tokens.forEach(token => {
			token.options.elev = event.target.value;
			token.place_sync_persist();
		});
	});

	return body;


}

function build_notes_flyout_menu(tokenIds) {
	let tokens = tokenIds.map(id => window.TOKEN_OBJECTS[id]).filter(t => t !== undefined);
	let body = $("<div></div>");
	let id = tokens[0].options.id;
	body.css({
		width: "200px", // once we add Markers, make this wide enough to contain them all
		padding: "5px",
		"flex-direction": "row"
	});
	let editNoteButton = $(`<button class="icon-note material-icons">Create Note</button>`)
	if(tokenIds.length=1){
		let has_note=id in window.JOURNAL.notes;
		if(has_note){
			let viewNoteButton = $(`<button class="icon-view-note material-icons">View Note</button>`)		
			let deleteNoteButton = $(`<button class="icon-note-delete material-icons">Delete Note</button>`)
			editNoteButton = $(`<button class="icon-note material-icons">Edit Note</button>`)
			body.append(viewNoteButton);
			body.append(editNoteButton);		
			body.append(deleteNoteButton);	
			viewNoteButton.off().on("click", function(){
				window.JOURNAL.display_note(id);
			});
			deleteNoteButton.off().on("click", function(){
				if(id in window.JOURNAL.notes){
					delete window.JOURNAL.notes[id];
					window.JOURNAL.persist();
					window.TOKEN_OBJECTS[id].place();
				}
			});
		}
		else {
			body.append(editNoteButton);
		}

		editNoteButton.off().on("click", function(){
			if (!(id in window.JOURNAL.notes)) {
				window.JOURNAL.notes[id] = {
					title: window.TOKEN_OBJECTS[id].options.name,
					text: '',
					plain: '',
					player: false
				}
			}
			window.JOURNAL.edit_note(id);
		});		
	}

	return body;
}

	

function build_conditions_and_markers_flyout_menu(tokenIds) {

	let tokens = tokenIds.map(id => window.TOKEN_OBJECTS[id]).filter(t => t !== undefined);
	let body = $("<div></div>");
	body.css({
		width: "fit-content", // once we add Markers, make this wide enough to contain them all
		padding: "5px",
		display: "flex",
		"flex-direction": "row"
	})

	const buildConditionItem = function(conditionName) {

		let conditionItem = $(`<li class="${determine_condition_item_classname(tokenIds, conditionName)} icon-${conditionName.toLowerCase().replaceAll("(", "-").replaceAll(")", "").replaceAll(" ", "-")}"></li>`);
		if (conditionName.startsWith("#")) {
			let lockedConditions = {
				[conditionName] : '',
				...JSON.parse(localStorage.getItem(`lockedConditions.${window.gameId}`))
			}
			let colorItem = $(`<input type='text' placeholder='custom condition'></input>`);
			tokens.every(token => {
				let colorItemArr = token.options.custom_conditions.find(e => e.name === conditionName)
				if(colorItemArr != undefined){
					colorItem.val(colorItemArr.text);	
					return false;
				}
				else{
					colorItem.val(lockedConditions[conditionName]);
					return false;
				}
				return true;
			});
		
			conditionItem.append(colorItem);
			colorItem.css("background-color", conditionName);
			colorItem.on("change", function(){
				let clickedItem = $(this).parent();
				tokens.forEach(token => {
					if($(this).val() == "" && token.hasCondition(conditionName)){
						token.removeCondition(conditionName)
					}
					else{
						if(token.hasCondition(conditionName)){
							token.removeCondition(conditionName);
						}
						token.addCondition(conditionName, $(this).val());
					}	
					token.place_sync_persist();	
				});
				clickedItem.removeClass("single-active all-active some-active active-condition");
				clickedItem.addClass(determine_condition_item_classname(tokenIds, conditionName));
			});



			conditionItem.off(`click.customCondition`).on('click.customCondition', function(){
				let clickedItem = $(this);
				tokens.forEach(token => {
						if(token.hasCondition(conditionName)){
							token.removeCondition(conditionName);
						}
						else{
							token.addCondition(conditionName, $(this).find('input').val());
						}
					token.place_sync_persist();	
				});
				clickedItem.removeClass("single-active all-active some-active active-condition");
				clickedItem.addClass(determine_condition_item_classname(tokenIds, conditionName));

			});

			
			let conditionLocked = lockedConditions[conditionName] != '';

			const conditionLock = $(`<span class="${conditionLocked ? `locked` : ''} condition-lock material-icons material-symbols-outlined"></span>`)
			
			conditionLock.off(`click.lock`).on(`click.lock`, function(e){
				e.stopPropagation();
				if($(this).hasClass('locked')){
					lockedConditions = {
						...lockedConditions,
						[conditionName] : '',
					}
					$(this).toggleClass('locked', false);
				}
				else{
					lockedConditions = {
						...lockedConditions,
						[conditionName] : colorItem.val(),
					}
					$(this).toggleClass('locked', true);
				}


				localStorage.setItem(`lockedConditions.${window.gameId}`, JSON.stringify(lockedConditions));
			})

			conditionItem.append(conditionLock);


		} else {
			conditionItem.append(`<span>${conditionName}</span>`);
			conditionItem.on("click", function (clickEvent) {
				let clickedItem = $(clickEvent.currentTarget);
				let deactivateAll = clickedItem.hasClass("some-active");
				tokens.forEach(token => {
					if (deactivateAll || token.hasCondition(conditionName)) {
						token.removeCondition(conditionName)
					} else {
						token.addCondition(conditionName)
					}
					token.place_sync_persist();
				});
				clickedItem.removeClass("single-active all-active some-active active-condition");
				clickedItem.addClass(determine_condition_item_classname(tokenIds, conditionName));
			});
		}


	
		return conditionItem;
	};

	let isPlayerTokensSelected = false;
	tokens.forEach(token => {
		if(token.isPlayer())
		{
			isPlayerTokensSelected = true;
		}
	});	
	let conditionsList = $(`<ul></ul>`);
	conditionsList.css("width", "180px");
	body.append(conditionsList);
	STANDARD_CONDITIONS.forEach(conditionName => {
		let conditionItem = buildConditionItem(conditionName);
		conditionItem.addClass("icon-condition");
		conditionsList.append(conditionItem);
	});
	if(isPlayerTokensSelected)
	{
		conditionsList.append($("<div id='playerTokenSelectedWarning'>A player token is selected this column of conditions must be set on the character sheet. Selecting a condition here will whisper the selected player(s).</div>"));
	}

	let markersList = $(`<ul></ul>`);
	markersList.css("width", "185px");
	body.append(markersList);
	CUSTOM_CONDITIONS.forEach(conditionName => {
		let conditionItem = buildConditionItem(conditionName);
		conditionItem.addClass("markers-icon");
		markersList.append(conditionItem);

	});

	let removeAllItem = $(`<li class="icon-condition icon-close-red"><span>Remove All</span></li>`);
	removeAllItem.on("click", function () {
		$(".active-condition").click(); // anything that is active should be deactivated.

	});
	conditionsList.prepend(removeAllItem);

	return body;
}

function build_adjustments_flyout_menu(tokenIds) {
	let tokens = tokenIds.map(id => window.TOKEN_OBJECTS[id]).filter(t => t !== undefined);

	// Aoe tokens are treated differently from everything else so we need to check this more often
	let isAoeList = tokens.map(t => t.isAoe());
	let uniqueAoeList = [...new Set(isAoeList)];
	const allTokensAreAoe = (uniqueAoeList.length === 1 && uniqueAoeList[0] === true);

	let body = $("<div></div>");
	body.css({
		width: "320px",
		padding: "5px"
	});
	// name
	let tokenNames = tokens.map(t => t.options.name);
	let uniqueNames = [...new Set(tokenNames)];
	let nameInput = $(`<input title="Token Name" placeholder="Token Name" name="name" type="text" />`);
	if (uniqueNames.length === 1) {
		nameInput.val(tokenNames[0]);
	} else {
		nameInput.attr("placeholder", "Multiple Values");
	}

	nameInput.on('keyup', function(event) {
		let newName = event.target.value;
		if (event.key == "Enter" && newName !== undefined && newName.length > 0) {
			tokens.forEach(token => {
				token.options.name = newName;
				token.place_sync_persist();
			});
		}
	});
	nameInput.on('focusout', function(event) {
		let newName = event.target.value;
		if (newName !== undefined && newName.length > 0) {
			tokens.forEach(token => {
				token.options.name = newName;
				token.place_sync_persist();
			});
		}
	});
	let nameWrapper = $(`
		<div class="token-image-modal-url-label-wrapper">
			<div class="token-image-modal-footer-title">Token Name</div>
		</div>
	`);
	nameWrapper.append(nameInput); // input below label
	body.append(nameWrapper);

	let tokenSizes = [];
	tokens.forEach(t => {
		tokenSizes.push(t.numberOfGridSpacesWide());
	});
	let uniqueSizes = [...new Set(tokenSizes)];
	console.log("uniqueSizes", uniqueSizes);
	let sizeInputs = build_token_size_input(uniqueSizes, function (newSize) {
		let tokenMultiplierAdjustment = (!window.CURRENT_SCENE_DATA.scaleAdjustment) ? 1 : (window.CURRENT_SCENE_DATA.scaleAdjustment.x > window.CURRENT_SCENE_DATA.scaleAdjustment.y) ? window.CURRENT_SCENE_DATA.scaleAdjustment.x : window.CURRENT_SCENE_DATA.scaleAdjustment.y;
			
		const hpps = Math.round(window.CURRENT_SCENE_DATA.hpps) * tokenMultiplierAdjustment;
		if (!isNaN(newSize)) {
			newSize = hpps * newSize;
		} else {
			console.log(`not updating tokens with size ${newSize}`); // probably undefined because we inject the "multiple" options below
			return;
		}
		tokens.forEach(token => {			
			// Reset imageScale if new size is larger
			if(token.options.size < newSize) {
				token.imageSize(1);
			}
			token.size(newSize);	
			clampTokenImageSize(token.options.imageSize, token.options.size);
		});
	}, allTokensAreAoe); // if we're only dealing with aoe, don't bother displaying the select list. Just show the size input
	body.append(sizeInputs);
	if (allTokensAreAoe) {
		sizeInputs.find("select").closest(".token-image-modal-footer-select-wrapper").hide(); // if we're only dealing with aoe, don't bother displaying the select list. Just show the size input
	}

	if (!allTokensAreAoe) {

		//image scaling size
		let tokenImageScales = tokens.map(t => t.options.imageSize);
		let uniqueScales = [...new Set(tokenImageScales)];
		let startingScale = uniqueScales.length === 1 ? uniqueScales[0] : 1;
		let imageSizeWrapper = build_token_image_scale_input(startingScale, tokens, function (imageSize) {
			tokens.forEach(token => {
				imageSize = clampTokenImageSize(imageSize, token.options.size);
				token.options.imageSize = imageSize;
				$(`.VTTToken[data-id='${token.options.id}']`).css("--token-scale", imageSize)
				token.place_sync_persist();
			});
		});
		body.append(imageSizeWrapper);
		if (tokens.some((t) => t.isAoe())){
			let imageSizeInput = imageSizeWrapper.find(".image-scale-input-number");
			let imageSizeInputRange = imageSizeWrapper.find(".image-scale-input-range");
			imageSizeInputRange.attr("disabled", true)
			imageSizeInputRange.attr("title", "Aoe tokens can't be adjusted this way")
			imageSizeInput.attr("disabled",true)
			imageSizeInput.attr("title", "Aoe tokens can't be adjusted this way")
		}


		//border color selections
		let tokenBorderColors = tokens.map(t => t.options.color);
		let initialColor = tokenBorderColors.length === 1 ? tokenBorderColors[0] : random_token_color();
		const borderColorWrapper = build_token_border_color_input(initialColor, function (newColor, eventType) {
			if (eventType === 'change') {
				tokens.forEach(token => {
					token.options.color = newColor;
					$("#combat_area tr[data-target='" + token.options.id + "'] img[class*='Avatar']").css("border-color", newColor);
					token.place_sync_persist();
				});
			}
			else {
				tokens.forEach(token => {
					token.options.color = newColor;
					token.place_sync_persist();
				});
			}
		});
		body.append(borderColorWrapper);

		let changeImageMenuButton = $("<button id='changeTokenImage' class='material-icons'>Change Token Image</button>")
		body.append(changeImageMenuButton)

		changeImageMenuButton.off().on("click", function() {
			close_token_context_menu();
			id = tokens[0].options.id;
			if (!(id in window.TOKEN_OBJECTS)) {
				return;
			}
			let tok = window.TOKEN_OBJECTS[id];
			display_change_image_modal(tok);
		});
	}
	return body;
}

function build_token_image_scale_input(startingScale, tokens, didUpdate) {
	if (isNaN(startingScale)) {
		startingScale = 1;
	}
	let maxImageScale
	if(!tokens){
		maxImageScale = 6;
	}
	else{
		maxImageScale = getTokenMaxImageScale(tokens[0].options.size);
	}


	let imageSizeInput = $(`<input class="image-scale-input-number" type="number" max="${maxImageScale}" min="0.2" step="0.1" title="Token Image Scale" placeholder="1.0" name="Image Scale">`);
	let imageSizeInputRange = $(`<input class="image-scale-input-range" type="range" value="1" min="0.2" max="${maxImageScale}" step="0.1"/>`);
	imageSizeInput.val(startingScale || 1);
	imageSizeInputRange.val(startingScale || 1);
	imageSizeInput.on('keyup', function(event) {
		let imageSize = event.target.value;	
		if(tokens !== false){
			imageSize = clampTokenImageSize(imageSize, tokens[0].options.size);
		}

		if (event.key === "Enter") {
		if(tokens !== false){
			imageSize = clampTokenImageSize(imageSize, tokens[0].options.size);
		}
			imageSizeInput.val(imageSize);
			imageSizeInputRange.val(imageSize);
			didUpdate(imageSize);
		} else if (event.key === "Escape") {
			$(event.target).blur();
		}
		imageSizeInputRange.val(imageSizeInput.val());
	});
	imageSizeInput.on('focusout', function(event) {
		let imageSize = event.target.value;		
		if(tokens !== false){
			imageSize = clampTokenImageSize(imageSize, tokens[0].options.size);
		}
		imageSizeInput.val(imageSize);	
		imageSizeInputRange.val(imageSize);
		didUpdate(imageSize);

		imageSizeInputRange.val(imageSizeInput.val());
	});
	imageSizeInput.on(' input change', function(){
		imageSizeInputRange.val(imageSizeInput.val());
	});
	imageSizeInputRange.on(' input change', function(){
		imageSizeInput.val(imageSizeInputRange.val());
	});
	imageSizeInputRange.on('mouseup', function(){
		let imageSize = event.target.value;	
		if(tokens !== false){
			imageSize = clampTokenImageSize(imageSize, tokens[0].options.size);
		}
		didUpdate(imageSize);
	});
	let imageSizeWrapper = $(`
		<div class="token-image-modal-url-label-wrapper image-size-wrapper">
			<div class="token-image-modal-footer-title image-size-title">Token Image Scale</div>
		</div>
	`);
	imageSizeWrapper.append(imageSizeInput); // Beside Label
	imageSizeWrapper.append(imageSizeInputRange); // input below label
	return imageSizeWrapper;
}

function build_options_flyout_menu(tokenIds) {
	let tokens = tokenIds.map(id => window.TOKEN_OBJECTS[id]).filter(t => t !== undefined);

	// Aoe tokens are treated differently from everything else so we need to check this more often
	let isAoeList = tokens.map(t => t.isAoe());
	let uniqueAoeList = [...new Set(isAoeList)];
	const allTokensAreAoe = (uniqueAoeList.length === 1 && uniqueAoeList[0] === true);
	let player_selected = false;

	let body = $("<div></div>");
	body.css({
		width: "320px",
		padding: "5px"
	})

	let token_settings = token_setting_options();
	if (tokens.length === 1 && !tokens[0].isPlayer()){
		let removename = "hidestat";
		token_settings = $.grep(token_settings, function(e){
		     return e.name != removename;
		});
	}
	for (var i = 0; i < tokens.length; i++) {
	    if(tokens[i].isPlayer()){
	    	player_selected = true;
	    	break;
	    }
	}
	if (player_selected){
		let removename = "player_owned";
		token_settings = $.grep(token_settings, function(e){
		     return e.name != removename;
		});
	}
	for(let i = 0; i < token_settings.length; i++) {
		let setting = token_settings[i];
		if (allTokensAreAoe && !availableToAoe.includes(setting.name)) {
			continue;
		} else if(setting.hiddenSetting || setting.name == 'defaultmaxhptype') {
			continue;
		}

		let tokenSettings = tokens.map(t => t.options[setting.name]);
		let uniqueSettings = [...new Set(tokenSettings)];
		let currentValue = null; // passing null will set the switch as unknown; undefined is the same as false
		if (uniqueSettings.length === 1) {
			currentValue = uniqueSettings[0];
		}

		if (setting.type === "dropdown") {
			let inputWrapper = build_dropdown_input(setting, currentValue, function(name, newValue) {
				tokens.forEach(token => {
					token.options[name] = newValue;
					token.place_sync_persist();
				});
			});
			body.append(inputWrapper);
		} else if (setting.type === "toggle") {
			let inputWrapper = build_toggle_input(setting, currentValue, function (name, newValue) {
				tokens.forEach(token => {
					token.options[name] = newValue;
					token.place_sync_persist();
				});
			});
			body.append(inputWrapper);
		} else {
			console.warn("build_options_flyout_menu failed to handle token setting option with type", setting.type);
		}
	}

	let resetToDefaults = $(`<button class='token-image-modal-remove-all-button' title="Reset all token settings back to their default values." style="width:100%;padding:8px;margin:10px 0px;">Reset Token Settings to Defaults</button>`);
	resetToDefaults.on("click", function (clickEvent) {
		let formContainer = $(clickEvent.currentTarget).parent();

		// disable all toggle switches
		formContainer
			.find(".rc-switch")
			.removeClass("rc-switch-checked")
			.removeClass("rc-switch-unknown");

		// set all dropdowns to their default values
		formContainer
			.find("select")
			.each(function () {
				let el = $(this);
				let matchingOption = token_settings.find(o => o.name === el.attr("name"));
				el.find(`option[value=${matchingOption.defaultValue}]`).attr('selected','selected');
			});

		// This is why we want multiple callback functions.
		// We're about to call updateValue a bunch of times and only need to update the UI (or do anything else really) one time
		token_settings.forEach(option => {
			tokens.forEach(token => token.options[option.name] = option.defaultValue);
		});
		tokens.forEach(token => token.place_sync_persist());


	});
	body.append(resetToDefaults);
	return body;
}

/**
 * Builds and returns HTML inputs for updating token size
 * @param tokenSizes {Array<Number>} the current size of the token this input is for
 * @param changeHandler {function} the function to be called when the input changes. This function takes a single {float} variable. EX: function(numberOfSquares) { ... } where numberOfSquares is 1 for medium, 2 for large, etc
 * @param forceCustom {boolean} whether or not to force the current setting to be custom even if the size is a standard size... We do this for aoe
 * @returns {*|jQuery|HTMLElement} the jQuery object containing all the input elements
 */
function build_token_size_input(tokenSizes, changeHandler, forceCustom = false) {
	let numGridSquares = undefined;
	// get the first value if there's only 1 value
	if (tokenSizes.length === 1) {
		numGridSquares = tokenSizes[0]
		if (isNaN(numGridSquares)) {
			numGridSquares = 1;
		}
	} else {
		// multiple options
		numGridSquares = -1
	}

	let upsq = window.CURRENT_SCENE_DATA.upsq;
	if (upsq === undefined || upsq.length === 0) {
		upsq = "ft";
	}

	const isSizeCustom = (forceCustom || ![0.5, 1, 2, 3, 4].includes(numGridSquares));
	console.log("isSizeCustom: ", isSizeCustom, ", forceCustom: ", forceCustom, ", numGridSquares: ", numGridSquares, ", [0.5, 1, 2, 3, 4].includes(numGridSquares):", [0.5, 1, 2, 3, 4].includes(numGridSquares))

	// Limit custom token scale to grid size 
	const maxScale = Math.max(window.CURRENT_SCENE_DATA.width * window.CURRENT_SCENE_DATA.scale_factor / window.CURRENT_SCENE_DATA.hpps);

	let customStyle = isSizeCustom ? "display:flex;" : "display:none;"
	const size = (numGridSquares > 0) ? (numGridSquares * window.CURRENT_SCENE_DATA.fpsq) : 1;
	let output = $(`
 		<div class="token-image-modal-footer-select-wrapper">
 			<div class="token-image-modal-footer-title">Token Size</div>
 			<select name="data-token-size">
			 	${numGridSquares === -1 ? '<option value="multiple" selected="selected" disabled="disabled">Multiple Values</option>' : ""}
 				<option value="0.5" ${numGridSquares > 0 && numGridSquares < 1 ? "selected='selected'": ""}>Tiny (2.5${upsq})</option>
 				<option value="1" ${numGridSquares === 1 ? "selected='selected'": ""}>Small/Medium (5${upsq})</option>
 				<option value="2" ${numGridSquares === 2 ? "selected='selected'": ""}>Large (10${upsq})</option>
 				<option value="3" ${numGridSquares === 3 ? "selected='selected'": ""}>Huge (15${upsq})</option>
 				<option value="4" ${numGridSquares === 4 ? "selected='selected'": ""}>Gargantuan (20${upsq})</option>
 				<option value="custom" ${numGridSquares !== -1 && isSizeCustom ? "selected='selected'": ""}>Custom</option>
 			</select>
 		</div>
 		<div class="token-image-modal-footer-select-wrapper" style="${customStyle}">
 			<div class="token-image-modal-footer-title">Custom size in ${upsq}</div>
 			<input type="number" min="${window.CURRENT_SCENE_DATA.fpsq / 2}" step="${window.CURRENT_SCENE_DATA.fpsq /2}"
			 name="data-token-size-custom" value=${size} style="width: 3rem;">
 		</div>
 	`);

	let tokenSizeInput = output.find("select");
	let customSizeInput = output.find("input");

	tokenSizeInput.change(function(event) {
		let customInputWrapper = $(event.target).parent().next();
		console.log("tokenSizeInput changed");
		if ($(event.target).val() === "custom") {
			customInputWrapper.show();
		} else {
			customInputWrapper.find("input").val($(event.target).val() * window.CURRENT_SCENE_DATA.fpsq)
			customInputWrapper.hide();
			changeHandler(parseFloat($(event.target).val()));
		}
	});

	customSizeInput.change(function(event) {
		console.log("customSizeInput changed");
		// convert custom footage into squares
		let newValue = 
			parseFloat($(event.target).val() / window.CURRENT_SCENE_DATA.fpsq);
		// tiny is the smallest you can go with a custom size
		if (newValue < 0.5){
			 newValue = 0.5
			$(event.target).val(window.CURRENT_SCENE_DATA.fpsq / 2)
		}
		if (!isNaN(newValue)) {
			changeHandler(newValue);
		}
	});

	return output;
}

/**
 * Ensures the new imageSize is within the allowed boundaries.
 * @param {number|string} newImageSize the new expected imageSize
 * @param {number} tokenSize the current token size
 * @returns the clamped imageSize
 */
 function clampTokenImageSize(newImageSize, tokenSize) {

	const maxScale = getTokenMaxImageScale(tokenSize);
	newImageSize = parseFloat(newImageSize);
	newImageSize = clamp(newImageSize, 0.2, maxScale);	

	// Update the DOM inputs if available
	updateScaleInputs(newImageSize, maxScale);

	return newImageSize;
}

/**
 * Calculates the maximum imageScale for the given token size.
 * @param {number} tokenSize current size of the token
 * @returns maximum value for imageScale
 */
 function getTokenMaxImageScale(tokenSize) {
	return Math.min(6, window.CURRENT_SCENE_DATA.width * window.CURRENT_SCENE_DATA.scale_factor / parseFloat(tokenSize));
}

/**
 * Updates the imageScales DOM inputs.
 * @param {number} newScale the new imageScale
 * @param {number} maxScale the maximum allowed imageScale
 */
function updateScaleInputs(newScale, maxScale) {
	// Get DOM inputs
	const imageScaleInputNumber = $(".image-scale-input-number");
	const imageScaleInputRange = $(".image-scale-input-range");

	// Update current value
	if(parseFloat(imageScaleInputNumber.val()) > maxScale) {
		imageScaleInputNumber.val(newScale);
	}
	if(parseFloat(imageScaleInputRange.val()) > maxScale) {
		imageScaleInputRange.val(newScale);
	}

	// Update max values
	imageScaleInputNumber.attr('max', maxScale);
	imageScaleInputRange.attr('max', maxScale);
}

//Start Quick Roll Menu//

function open_quick_roll_menu(e){
	//opens a roll menu for group rolls 
	console.log("Opening Roll menu")
	$("#qrm_dialog").remove();

	let qrm = $("<div id='qrm_dialog'></div>");
	qrm.css('background', "#f9f9f9");
	qrm.css('width', '410px');
	qrm.css('top', e.clientY+'px');
	qrm.css('left', e.clientX+'px');
	qrm.css('height', '250px');
	qrm.css('z-index', 49001);
	qrm.css('border', 'solid 2px gray');
	qrm.css('display', 'flex');
	qrm.css('margin', '1px 1px')
	qrm.css('flex-direction', 'column');
	qrm.css('position', 'fixed')
	qrm.css('border-style', 'solid');
    qrm.css('border-color', '#ddd'); 

	$("#site").append(qrm);
	qrm.empty();	
	
	qrm.addClass("moveableWindow");

	const qrm_title_bar=$("<div id='quick_roll_title_bar' class='text-input-title-bar restored'> Quick Roll Menu </div>")
	qrm_title_bar.css('padding', '1px 3px');
	qrm_title_bar.css('position', 'sticky');
	const qrm_title_bar_popout=$('<div class="popout-button"><svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="#000000"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M18 19H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h5c.55 0 1-.45 1-1s-.45-1-1-1H5c-1.11 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-6c0-.55-.45-1-1-1s-1 .45-1 1v5c0 .55-.45 1-1 1zM14 4c0 .55.45 1 1 1h2.59l-9.13 9.13c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0L19 6.41V9c0 .55.45 1 1 1s1-.45 1-1V4c0-.55-.45-1-1-1h-5c-.55 0-1 .45-1 1z"/></svg></div>');
	const qrm_title_bar_exit=$('<div id="quick_roll_title_bar_exit" class="title-bar-exit"><svg class="" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g transform="rotate(-45 50 50)"><rect></rect></g><g transform="rotate(45 50 50)"><rect></rect></g></svg></div>')
	qrm_area=$("<table id='quick_roll_area'/>");
	
	const qrm_list_wrapper = $(`<div class="menu_table"></div>`);
	qrm_list_wrapper.mouseover(function(){
		$(this).css('--scrollY', $(this).scrollTop());
	});
	qrm_title_bar_exit.click(function(){
		$("#qrm_clear_all").click();
		$("#qrm_dialog").remove();
	});
	qrm_title_bar_popout.click(function() {
		$("#qrm_dialog").hide();
		let name = "Quick Roll Menu";

		$('#qrm_dialog #quick_roll_footer select#qrm_save_dropdown').find(`option[value='${$("#qrm_dialog #quick_roll_footer select#qrm_save_dropdown").val()}']`).attr('selected', 'selected');
		$('#qrm_dialog #quick_roll_footer select#qrm_apply_conditions').find(`option[value='${$("#qrm_dialog #quick_roll_footer select#qrm_apply_conditions").val()}']`).attr('selected', 'selected');	
		popoutWindow(name, $("#qrm_dialog"), $("#qrm_dialog").width(),  $("#qrm_dialog").height()-25);//subtract titlebar height
		qrm_update_popout();
		
		//clear the popout on close
		$(window.childWindows[name]).on('unload', function(){
			$("#qrm_clear_all").click();
			$("#qrm_dialog").remove();
			$(window.childWindows[name]).off();
		});


	})
	qrm_title_bar.append(qrm_title_bar_popout);
	qrm_title_bar.append(qrm_title_bar_exit);
	$("#qrm_dialog").append(qrm_title_bar);
	qrm_list_wrapper.append(qrm_area);

	$(qrm_title_bar).dblclick(function(){
		if($(qrm_title_bar).hasClass("restored")){
			$(qrm_title_bar).data("prev-height", $("#qrm_dialog").height());
			$(qrm_title_bar).data("prev-width", $("#qrm_dialog").width());
			$(qrm_title_bar).data("prev-top", $("#qrm_dialog").css("top"));
			$(qrm_title_bar).data("prev-left", $("#qrm_dialog").css("left"));
			$("#qrm_dialog").css("top", $(qrm_title_bar).data("prev-minimized-top"));
			$("#qrm_dialog").css("left", $(qrm_title_bar).data("prev-minimized-left"));
			$("#qrm_dialog").height(25);
			$("#qrm_dialog").width(200);
			$("#qrm_dialog").css("visibility", "hidden");
			$(qrm_title_bar).css("visibility", "visible");
			$(qrm_title_bar).addClass("minimized");
			$(qrm_title_bar).removeClass("restored");
		}
		else if($(qrm_title_bar).hasClass("minimized")){
			$(qrm_title_bar).data("prev-minimized-top", $("#qrm_dialog").css("top"));
			$(qrm_title_bar).data("prev-minimized-left", $("#qrm_dialog").css("left"));
			$("#qrm_dialog").height($(qrm_title_bar).data("prev-height"));
			$("#qrm_dialog").width($(qrm_title_bar).data("prev-width"));
			$("#qrm_dialog").css("top", $(qrm_title_bar).data("prev-top"));
			$("#qrm_dialog").css("left", $(qrm_title_bar).data("prev-left"));
			$(qrm_title_bar).addClass("restored");
			$(qrm_title_bar).removeClass("minimized");
			$("#qrm_dialog").css("visibility", "visible");
		}
	});
	let qrm_dc_input = $('<input class="menu_roll_input" id="qrm_save_dc" placeholder="Save DC" name="save_dc" title="Enter the value for the DC of the saving throw."></input>')
	//qrm_dc_input.tooltip({show: { duration: 1000 }});
	qrm_dc_input.attr('style', 'width: 25% !important');

	// Lets add the selectmenu image to each of these save types too... use the images from character sheet for save.
	let save_type_dropdown = $('<select class="general_input" id="qrm_save_dropdown" title="Select the type of saving throw to be made. ">Save Type</select>')
	save_type_dropdown.append($(`<option value="1" data-name="dex" data-style='url(https://www.dndbeyond.com/content/1-0-1849-0/skins/waterdeep/images/icons/abilities/dexterity.svg)'>DEXTERITY</option>`)) 
	save_type_dropdown.append($(`<option value="4" data-name="wis" data-style='url(https://www.dndbeyond.com/content/1-0-1849-0/skins/waterdeep/images/icons/abilities/wisdom.svg)'>WISDOM</option>`))
	save_type_dropdown.append($(`<option value="2" data-name="con" data-style='url(https://www.dndbeyond.com/content/1-0-1849-0/skins/waterdeep/images/icons/abilities/constitution.svg)'>CONSTITUTION</option>`))
	save_type_dropdown.append($(`<option value="0" data-name="str" data-style='url(https://www.dndbeyond.com/content/1-0-1849-0/skins/waterdeep/images/icons/abilities/strength.svg)'>STRENGTH</option>`))
	save_type_dropdown.append($(`<option value="3" data-name="int" data-style='url(https://www.dndbeyond.com/content/1-0-1849-0/skins/waterdeep/images/icons/abilities/intelligence.svg)'>INTELLIGENCE</option>`))
	save_type_dropdown.append($(`<option value="5" data-name="cha" data-style='url(https://www.dndbeyond.com/content/1-0-1849-0/skins/waterdeep/images/icons/abilities/charisma.svg)'>CHARISMA</option>`))
	//save_type_dropdown.tooltip({show: { duration: 1000 }})
	save_type_dropdown.attr('style', 'width: 22% !important');

	$( function() {
		$.widget( "custom.iconselectmenu", $.ui.selectmenu, {
		_renderItem: function( ul, item ) {
			var li = $( `<li class='icon-avatar' >` )
			wrapper = $( "<div>", { text: item.label } );
			$( "<li>", {
			style: 'background-image: ' + item.element.attr( "data-style" ),
			"class": "ui-icon " + item.element.attr( "data-class" )}).appendTo(wrapper);
			return li.append( wrapper ).appendTo( ul );
		}
		});
		$("#qrm_save_dropdown")
		.iconselectmenu({ change: function( event, ui ) { save_type_change(this); }})
    		.addClass( "ui-menu-icons" );
	});

	let damage_input  = $('<input class="menu_roll_input" id="hp_adjustment_failed_save" placeholder="Damage/Roll" title="Enter the integer value for damage or the roll to be made i.e. 8d6"></input>')
	//damage_input.tooltip({show: { duration: 1000 }})
	damage_input.attr('style', 'width: 25% !important');

	let half_damage_input = $('<input class="menu_roll_input" id="half_damage_save" placeholder="Success Damage" title="Enter the integer value for half damage, or autopopulate from damage entry as half rounded down.""></input>')
	//half_damage_input.tooltip({show: { duration: 1000 }})
	half_damage_input.attr('style', 'width: 25% !important');

	damage_input.change(function(){
		_dmg = $('#hp_adjustment_failed_save').val();
		if (_dmg.includes('d')) {
			var expression = _dmg
			var roll = new rpgDiceRoller.DiceRoll(expression);
			console.log(expression + "->" + roll.total);
			//reassign to the input 
			_dmg = roll.total
			$('#hp_adjustment_failed_save').val(_dmg);
		}
		else {
			_dmg.replace(/[^\d.-]/g, '')
		}
		$("#half_damage_save").val(Math.floor(_dmg/2));
		qrm_update_popout();
	});

	//Roll Button 
	let qrm_roll=$("<button id='qrm_roll_button' >ROLL</button>");
	qrm_roll.css('width', '13%');
	qrm_roll.click(function() {
		$('#qrm_apply_damage').show()
		$('#qrm_apply_healing').show()
		$("#quick_roll_area").children('tr').children('td').find('#roll_bonus').each(function (){
			let modifier = $(this).val().toLowerCase();
			// Add a + if the user doesn't add anything. 
			if (!modifier.includes('+') && !modifier.includes('-')){
				modifier = '+' + modifier
			}
			dice = '1d20'
			if (modifier.includes("a") == true) {
				modifier = modifier.replace(/[^\d.-]/g, '');
				dice = '2d20kh1 +';
			}
			else if (modifier.includes("d") == true) {
				modifier = modifier.replace(/[^\d.-]/g, '');
				dice = '2d20kl1 +';
			}
			var expression = dice + modifier;
			var roll = new rpgDiceRoller.DiceRoll(expression);
			console.log(expression + "->" + roll.total);
			//reassign to the input 
			result = $(this).parent().children('#qrm_roll_result')
		
			// Append success or fail to the value... not sure this is best, there are a few ways but this is simple
			//display a Save success or failure.
			save_dc = $("#qrm_save_dc").val()
			if (save_dc != ""){
				if (parseInt(roll.total) >= parseInt(save_dc)){
					result.val(roll.total + ' Success!')
					result.css('background', 'green')
				}
				else {
					result.val(roll.total + ' Fail!')
					result.css('background', 'red')}
			}
			else {//if not defined apply full damage.
				result.val(roll.total + ' Auto-Fail')
				result.css('background', 'yellow')
			}
		});
		setTimeout(qrm_update_popout,500);
	});

	//Clear Button
	let qrm_clear = $("<button id='qrm_clear_all' >CLEAR </button>");
	qrm_clear.css('width', '15%');
	qrm_clear.css('bottom', '5px');
	qrm_clear.css('right', '5px')
	qrm_clear.css('position','absolute');

	qrm_clear.click(function() {
		$("#quick_roll_area").children('tr').each(function (){
			$(this).find('#qrm_remove').click()
		});
		qrm_update_popout();
	});

	//Update HP buttons	
	let qrm_hp_adjustment_wrapper=$('<div id="qrm_adjustment_wrapper" class="adjustments_wrapper"></div>');

	let damage_hp = $('<button title="Apply Roll as Damage" id="qrm_damage" value="ON" class="damage_heal_button active_roll_mod" >DAMAGE</button>')
	damage_hp.click(function() {
	
		console.log($(this).val())
		console.log($(this))
		//toggle off the other button
		$(heal_hp).val("OFF")
		$(heal_hp).removeClass('active_roll_mod')
		
		if($(this).val() == "ON"){
			$(this).val("OFF");
			$(this).removeClass('active_roll_mod')
		}
	  	else if($(this).val() == "OFF"){
			$(this).val("ON");
			$(this).addClass('active_roll_mod')
		}
	});
	let heal_hp = $('<button title="Apply Roll as Healing" id="qrm_healing" value="OFF" class="damage_heal_button">HEAL</button>')
	heal_hp.click(function(){
		
		console.log('EHRE')
		console.log($(this).val())
		console.log($(this))
		//toggle off the other button
		$(damage_hp).val("OFF")
		$(damage_hp).removeClass('active_roll_mod')

		if($(this).val() == "ON"){
			$(this).val("OFF");
			$(this).removeClass('active_roll_mod')
		}
	  	else if($(this).val() == "OFF"){
			$(this).val("ON");
			$(this).addClass('active_roll_mod')
		}
	});

	qrm_hp_adjustment_wrapper.append(heal_hp)
	qrm_hp_adjustment_wrapper.append(damage_hp)

	//Allow applying condtions with damage/healing after a failed save
	apply_conditions = $('<select class="general_input" id="qrm_apply_conditions" title="Select a conditions to be applied on failed save."> Apply Conditions </select>');
	apply_conditions.attr('style', 'width: 26% !important');
	apply_conditions.append($(`<option value='conditions' data-style="background-image: none !important;">CONDITIONS</option>`))
	apply_conditions.append($(`<option value='remove_all' data-class="dropdown-remove" >Remove All</option>`))

	STANDARD_CONDITIONS.forEach(conditionName => {
		let cond_name = conditionName.toLowerCase().replaceAll("(", "-").replaceAll(")", "").replaceAll(" ", "-")
		apply_conditions.append($(`<option value=${conditionName} data-name="${cond_name}" data-style="background-image: url(https://www.dndbeyond.com/content/1-0-1849-0/skins/waterdeep/images/icons/conditions/${cond_name}.svg)";>${cond_name}</option>`));
	});
	CUSTOM_CONDITIONS.forEach(conditionName => {
		let cond_name = conditionName.toLowerCase().replaceAll("(", "-").replaceAll(")", "").replaceAll(" ", "-")
		if (cond_name.includes('#')){
			apply_conditions.append($(`<option value=${conditionName} data-style="background-color: ${cond_name}; background-image: none;";>Custom Condition</option>`));
		}
		else{
			let cond = $(`<option  value=${conditionName} data-name="${cond_name}" data-class="dropdown-${cond_name}";>${cond_name}</option>`)
			apply_conditions.append(cond);
		}
	});
		
	$( function() {
			$.widget( "custom.iconselectmenu", $.ui.selectmenu, {
			_renderItem: function( ul, item ) {
				var li = $( `<li class='icon-avatar' >` )
				wrapper = $( "<div>", { text: item.label } );
				$( "<li>", {
				style: item.element.attr( "data-style" ),
				"class": "ui-icon " + item.element.attr( "data-class" )}).appendTo(wrapper);
				return li.append( wrapper ).appendTo( ul );
			}
			});
			$("#qrm_apply_conditions")
			.iconselectmenu()
			.iconselectmenu( "menuWidget")
				.addClass( "ui-menu-icons" );
	});
	apply_conditions.attr('style', 'width: 26% !important');

	let apply_adjustments = $('<button title="Apply Damage/Healing and Conditions on failed save" id="qrm_apply_adjustments" class="general_input"> APPLY </button>')
	apply_adjustments.click(function() {
		qrm_apply_hp_adjustment($('#qrm_healing').val());
	});

	let qrm_footer = $("<div id='quick_roll_footer' class='footer-input-wrapper tfoot'/>");
	qrm_footer.css('bottom', '0');
	qrm_footer.css('position','sticky');
	qrm_footer.css('background', "#f9f9f9");
	qrm_footer.css('height', 'fit-content');
	
	qrm_footer.append(damage_input)
	qrm_footer.append(half_damage_input)
	qrm_footer.append(qrm_dc_input)
	qrm_footer.append(save_type_dropdown)
	qrm_footer.append(qrm_roll);
	qrm_footer.append(apply_conditions);
	
	qrm_footer.append(qrm_hp_adjustment_wrapper);
	qrm_footer.append(apply_adjustments)
	//qrm_footer.append(heal_hp);
	//qrm_footer.append(damage_hp);
	qrm_footer.append(qrm_clear);
	//damage_hp.hide()
	//heal_hp.hide()

	//header
	qrm.append(qrm_title_bar);
	//body
	qrm.append(qrm_list_wrapper);
	//footer
	qrm.append(qrm_footer);
	
	qrm.css('opacity', '0.0');
	qrm.animate({
		opacity: '1.0'
	}, 1000);
	
	qrm.draggable({
		addClasses: false,
		scroll: false,
		containment: "#windowContainment",
		start: function () {
			$("#resizeDragMon").append($('<div class="iframeResizeCover"></div>'));			
			$("#sheet").append($('<div class="iframeResizeCover"></div>'));
		},
		stop: function () {
			$('.iframeResizeCover').remove();
		}
	});
	qrm.resizable({
		addClasses: false,
		handles: "all",
		containment: "#windowContainment",
		start: function () {
			$("#resizeDragMon").append($('<div class="iframeResizeCover"></div>'));			
			$("#sheet").append($('<div class="iframeResizeCover"></div>'));
		},
		stop: function () {
			$('.iframeResizeCover').remove();
		},
		minWidth: 215,
		minHeight: 200
	});
	$("#qrm_dialog").mousedown(function() {
		frame_z_index_when_click($(this));
	});
}

function add_to_quick_roll_menu(token){
	//Adds a specific target to the quick roll menu

	window.TOKEN_OBJECTS[token.options.id].in_qrm = true

	if(token.options.name == "Not in the current map")
		return;
	if (token.isAoe()) {
		return; // don't add aoe to combat tracker
	}

	qrm_entry=$("<tr/>");
	qrm_entry.attr("data-target", token.options.id);	
	qrm_entry.attr("data-name", token.options.name);
	//qrm_entry.tooltip({show: { duration: 1000 }});
	
	img=$(`<img width=42 height=42 class='Avatar_AvatarPortrait__2dP8u' title=${token.options.name}>`);
	img.attr('src',token.options.imgsrc);
	img.css('border','3px solid '+token.options.color);
	img.css('margin', '2px 2px');
	if (token.options.hidden == true){
		img.css('opacity','0.5');
	}
	//img.tooltip({show: { duration: 1000 },position: { my: "left+15 center", at: "right center" }});
	qrm_entry.append($("<td/>").append(img));
	
	//qrm_entry_name_hp_bonus = $("<td style='width:60%;'/>")
	qrm_entry_name = $("<td style='display:block; width:100%; overflow:hidden;'/>")
	qrm_entry_row = $("<td style='display:block; width:100%;'/>")
	qrm_entry_row_rolls = $("<td style='display:inline-flex; width:40%;'/>")
	qrm_entry_row_hp = $("<td style='display:inline-flex; width:25%; white-space: nowrap;'/>")
	qrm_entry_row_buttons = $("<td style='display:inline-flex; width:35%;'/>")

	name_line = $("<div class='qrm_name_line'>"+token.options.name+"</div>")

	if(token.options.monster > 0)
		qrm_entry.attr('data-monster',token.options.monster);

	let roll_box=$("<input id='roll_bonus' class='menu_roll_input' maxlength=4 style='text-align: center; font-size:12px; width:35%;' title='Use +/- for custom bonus, add A or D for Adv/Disadv'>");
	//roll_box.tooltip({show: { duration: 1000 }});

	let roll_result=$("<input id='qrm_roll_result' class='menu_roll_input' style='text-align: center; font-size:12px; margin:2px; width:55%;' title='Result of roll'>");
	//roll_result.tooltip({show: { duration: 1000 }});

	let roll_mods=$('<div class="roll_mods_group"></div>');
	//roll_mods.tooltip({show: { duration: 1000 }});

	roll_mod_adv = $('<button title="Advantage to roll" id="adv" name="roll_mod" value="OFF" class="roll_mods_button icon-advantage markers-icon" />')
	//roll_mod_adv.tooltip({show: { duration: 1000 }})
	roll_mod_adv.click(function(){
		let row_id = $(this).closest('tr').attr('data-target');
		let target_button = $(`tr[data-target='${row_id}'] #adv`);
		let roll_bonus_target = target_button.parent().parent().children('#roll_bonus');
		roll_bonus_target.val(roll_bonus_target.val().replaceAll(/[ad]/gi, ''))
	
		let disadv_button = target_button.parent().children('#disadv');
		$(disadv_button).val("OFF")
		$(disadv_button).removeClass('active_roll_mod')
		
		if(target_button.val() == "ON"){
			target_button.val("OFF");
			target_button.removeClass('active_roll_mod')
		}
	  	else if(target_button.val() == "OFF"){
			target_button.val("ON");
			roll_bonus_target.val(roll_bonus_target.val() + 'a')
			target_button.addClass('active_roll_mod')
		}
		if(childWindows['Quick Roll Menu']){
			qrm_update_popout();
		}
	});
	roll_mod_disadv = $('<button title="Disadvantage to roll" id="disadv" name="roll_mod" value="OFF" class="roll_mods_button icon-disadvantage markers-icon" />')
	//roll_mod_disadv.tooltip({show: { duration: 1000 }})
	roll_mod_disadv.click(function(){
		let row_id = $(this).closest('tr').attr('data-target');
		let target_button = $(`tr[data-target='${row_id}'] #disadv`);
		let roll_bonus_target=target_button.parent().parent().children('#roll_bonus');
		roll_bonus_target.val(roll_bonus_target.val().replaceAll(/[ad]/gi, ''))

		let adv_button = target_button.parent().children('#adv');
		$(adv_button).val("OFF")
		$(adv_button).removeClass('active_roll_mod')

		if(target_button.val() == "ON"){
			target_button.val("OFF");
			target_button.removeClass('active_roll_mod')
		}
	  	else if(target_button.val() == "OFF"){
			target_button.val("ON");
			roll_bonus_target.val(roll_bonus_target.val() + 'd')
			target_button.addClass('active_roll_mod')
		}
		if(childWindows['Quick Roll Menu']){
			qrm_update_popout();
		}
	});
	roll_mods.append(roll_mod_adv)
	roll_mods.append(roll_mod_disadv)

	roll_bonus = qrm_fetch_stat(token);
	roll_box.val(roll_bonus)

	var hp_input = $("<input id='qrm_hp' class='menu_hp_input'>");
	hp_input.css('text-align', 'right');
	
	if(token.isPlayer()){
		hp_input.prop("disabled", true);
		hp_input.css('color', 'gray')
	}
	hp_input.val(token.hp);

	if(hp_input.val() === '0'){
		qrm_entry.toggleClass("ct_dead", true);
	}
	else{
		qrm_entry.toggleClass("ct_dead", false);
	}

	var divider = $("<div style='display:inline-block;'>/</>");
		
	var maxhp_input = $("<input id='qrm_maxhp' class='menu_hp_input'>");
	maxhp_input.css('text-align', 'left');

	if(token.isPlayer()){
		maxhp_input.prop("disabled", true);
		maxhp_input.css('color', 'gray')
	}
	maxhp_input.val(token.maxHp);

	if (!token.isPlayer()) {
		hp_input.change(function(e) {
			var selector = "div[data-id='" + token.options.id + "']";
			var old = $("#tokens").find(selector);
		
			if (hp_input.val().trim().startsWith("+") || hp_input.val().trim().startsWith("-")) {
				hp_input.val(Math.max(0, parseInt(token.hp) + parseInt(hp_input.val())));
			}

			old.find(".hp").val(hp_input.val().trim());	

			if(window.all_token_objects[token.options.id] != undefined){
				window.all_token_objects[token.options.id].hp = hp_input.val();
			}			
			if(window.TOKEN_OBJECTS[token.options.id] != undefined){		
				window.TOKEN_OBJECTS[token.options.id].hp = hp_input.val();	
				window.TOKEN_OBJECTS[token.options.id].update_and_sync();
			}			
			qrm_update_popout();
		});
		hp_input.click(function(e) {
			$(e.target).select();
		});
		maxhp_input.change(function(e) {
			var selector = "div[data-id='" + token.options.id + "']";
			var old = $("#tokens").find(selector);

			if (maxhp_input.val().trim().startsWith("+") || maxhp_input.val().trim().startsWith("-")) {
				maxhp_input.val(Math.max(0, parseInt(token.hp) + parseInt(maxhp_input.val())));
			}

			old.find(".max_hp").val(maxhp_input.val().trim());
			if(window.all_token_objects[token.options.id] != undefined){
				window.all_token_objects[token.options.id].maxHp = maxhp_input.val();
			}
			if(window.TOKEN_OBJECTS[token.options.id] != undefined){		
				window.TOKEN_OBJECTS[token.options.id].maxHp = maxhp_input.val();	
				window.TOKEN_OBJECTS[token.options.id].update_and_sync();
			}			
			qrm_update_popout();
		});
		maxhp_input.click(function(e) {
			$(e.target).select();
		});
	}
	else {
		hp_input.keydown(function(e) { if (e.keyCode == '13') token.update_from_page(); e.preventDefault(); }); // DISABLE WITHOUT MAKING IT LOOK UGLY
		maxhp_input.keydown(function(e) { if (e.keyCode == '13') token.update_from_page(); e.preventDefault(); });
	}

	qrm_entry_buttons = $("<td style='height:100%; text-align: right; width:100%; top: 1px; position: relative; white-space:nowrap'>");
	
	find=$('<button class="qrm_buttons_bar" title="Find Token" style="display:inline-block;"><svg class="findSVG" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 11c1.33 0 4 .67 4 2v.16c-.97 1.12-2.4 1.84-4 1.84s-3.03-.72-4-1.84V13c0-1.33 2.67-2 4-2zm0-1c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6 .2C18 6.57 15.35 4 12 4s-6 2.57-6 6.2c0 2.34 1.95 5.44 6 9.14 4.05-3.7 6-6.8 6-9.14zM12 2c4.2 0 8 3.22 8 8.2 0 3.32-2.67 7.25-8 11.8-5.33-4.55-8-8.48-8-11.8C4 5.22 7.8 2 12 2z"/></svg></button>');
	//find.tooltip({show: { duration: 1000 }})
	find.click(function(){
		var target=$(this).parent().parent().parent().parent().attr('data-target');
		if(target in window.TOKEN_OBJECTS){
			window.TOKEN_OBJECTS[target].highlight();	     
		}
		else if(target in window.all_token_objects){
			place_token_in_center_of_view(window.all_token_objects[target].options);
		  	$(`#quick_roll_area tr[data-target='${target}'] .findSVG`).remove();
           	let findSVG=$('<svg class="findSVG" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 11c1.33 0 4 .67 4 2v.16c-.97 1.12-2.4 1.84-4 1.84s-3.03-.72-4-1.84V13c0-1.33 2.67-2 4-2zm0-1c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6 .2C18 6.57 15.35 4 12 4s-6 2.57-6 6.2c0 2.34 1.95 5.44 6 9.14 4.05-3.7 6-6.8 6-9.14zM12 2c4.2 0 8 3.22 8 8.2 0 3.32-2.67 7.25-8 11.8-5.33-4.55-8-8.48-8-11.8C4 5.22 7.8 2 12 2z"/></svg>');	
            $(`#quick_roll_area tr[data-target='${target}'] .findTokenCombatButton`).append(findSVG);
		}
	});
	qrm_entry_buttons.append(find);

	remove_from_list=$('<button title="Remove from menu" id="qrm_remove" class="qrm_buttons_bar" style="display:inline-block;"><svg class="delSVG" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg></button>');
	//remove_from_list.tooltip({show: { duration: 1000 }})
	remove_from_list.click(
		function() {
			console.log('Removing from list')
			var target=$(this).parent().parent().parent().parent().attr('data-target');
			if(target in window.TOKEN_OBJECTS){
				remove_from_quick_roll_menu(window.TOKEN_OBJECTS[target]);	     
			}
		}
	);
	qrm_entry_buttons.append(remove_from_list);
	
	if(token.options.statBlock){
		stat_block=$('<button title="Open Monster Stat Block" class="qrm_buttons_bar" style="display:inline-block;"><svg class="statSVG" xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><g><rect fill="none" height="24" width="24"/><g><path d="M19,5v14H5V5H19 M19,3H5C3.9,3,3,3.9,3,5v14c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V5C21,3.9,20.1,3,19,3L19,3z"/></g><path d="M14,17H7v-2h7V17z M17,13H7v-2h10V13z M17,9H7V7h10V9z"/></g></svg></button>');
		
		stat_block.click(function(){
			window.JOURNAL.display_note(token.options.statBlock);
		});
		if(!token.isMonster()){
			stat_block.css("visibility", "hidden");
		}
	}
	else if(token.isMonster() == true){
		stat_block=$('<button title="Open Monster Stat Block" class="qrm_buttons_bar" style="display:inline-block;"><svg class="statSVG" xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><g><rect fill="none" height="24" width="24"/><g><path d="M19,5v14H5V5H19 M19,3H5C3.9,3,3,3.9,3,5v14c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V5C21,3.9,20.1,3,19,3L19,3z"/></g><path d="M14,17H7v-2h7V17z M17,13H7v-2h10V13z M17,9H7V7h10V9z"/></g></svg></button>');
		
		stat_block.click(function(){
			load_monster_stat(token.options.monster, token.options.id);
		});
		if(!token.isMonster()){
				stat_block.css("visibility", "hidden");
		}
	}	
	else if (token.isPlayer() == true) {
		stat_block=$('<button title="Open Player Stat Block" class="qrm_buttons_bar" style="display:inline-block;"><svg class="statSVG" xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><g><rect fill="none" height="24" width="24"/><g><path d="M19,5v14H5V5H19 M19,3H5C3.9,3,3,3.9,3,5v14c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V5C21,3.9,20.1,3,19,3L19,3z"/></g><path d="M14,17H7v-2h7V17z M17,13H7v-2h10V13z M17,9H7V7h10V9z"/></g></svg></button>');
		stat_block.click(function(){
			open_player_sheet(token.options.id);
		});
	}
	else{
		stat_block=$('<button title="No Stat Block for custom tokens" disabled="true" class="qrm_buttons_bar" style="display:inline-block;"><svg class="statSVG" xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><g><rect fill="none" height="24" width="24"/><g><path d="M19,5v14H5V5H19 M19,3H5C3.9,3,3,3.9,3,5v14c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V5C21,3.9,20.1,3,19,3L19,3z"/></g><path d="M14,17H7v-2h7V17z M17,13H7v-2h10V13z M17,9H7V7h10V9z"/></g></svg></button>');
		//can add the below if people don't like the disabled button
		//stat_block.click(function(){
		//	alert('Sorry, this appears to be a custom token, there was no stat block to fetch.');
		//});
	}
	qrm_entry_buttons.append(stat_block)
	//stat_block.tooltip({show: { duration: 1000 }})

	qrm_entry_name.append(name_line);
	
	qrm_entry_row_rolls.append(roll_box);
	qrm_entry_row_rolls.append(roll_result);
	qrm_entry_row_rolls.append(roll_mods);
	
	qrm_entry_row_hp.append(hp_input);
	qrm_entry_row_hp.append(divider);
	qrm_entry_row_hp.append(maxhp_input);

	qrm_entry_row.append(qrm_entry_row_rolls)
	qrm_entry_row.append(qrm_entry_row_hp)

	
	qrm_entry_row_buttons.append(qrm_entry_buttons)
	qrm_entry_row.append(qrm_entry_row_buttons)

	qrm_entry.append(qrm_entry_name);
	qrm_entry.append(qrm_entry_row);
	
	qrm_update_popout();
	$("#quick_roll_area").append(qrm_entry)
}

function save_type_change(dropdown){
	console.log("Save type is: "+ dropdown.value );
	$('#quick_roll_area').children('tr').each(function () {
		let x = window.TOKEN_OBJECTS[$(this).attr('data-target')]
		roll_bonus = qrm_fetch_stat(x)
		$(this).find('#roll_bonus').val(roll_bonus)
	});
}

function qrm_fetch_stat(token) {
	//if its a monster it needs to be calulated.
	if(token.options.monster > 0 || token.options.monster == 'open5e'){
		let stat = (cached_monster_items[token.options.monster]?.monsterData) ? cached_monster_items[token.options.monster]?.monsterData : cached_open5e_items[token.options.itemId]?.monsterData;

		if(typeof(stat) != 'undefined'){
			save_dropdown_value = parseInt($('#qrm_save_dropdown').val());
			
			//modifier = Math.floor((stat.stats.find(obj => {return obj.statId === save_dropdown_value}).value - 10) / 2.0);
			modifier = Math.floor((stat.stats[save_dropdown_value].value - 10) / 2.0);
			save_dropdown_value += 1;// need +1 offset for saves (not normal ability scores as above) as they are stored differently
			
			let x = stat.savingThrows.find(obj => {return obj.statId === save_dropdown_value});
			
			if (typeof(x) != 'undefined'){
				//add proficiency bonus if proficent 
				saving_throw_bonus = convert_CR_to_proficiency(stat.challengeRatingId);
				if (x.bonusModifier != null){
					saving_throw_bonus += x.bonusModifier;
				}
			}
			else {
				saving_throw_bonus = 0; 
			}
			roll_bonus = modifier + saving_throw_bonus;
			if (roll_bonus >= 0){
				roll_bonus = "+"+roll_bonus;
			}
		}
		console.log(roll_bonus);
	}
	else if (token.isPlayer() == true) {
		save_dropdown_value = parseInt($('#qrm_save_dropdown').val());
		//This relies of player data being loaded, which may take a few seconds after the page opens
		//if its a player character they have the save stored
		roll_bonus = token.options.abilities[save_dropdown_value]['save']

		if (roll_bonus >= 0){
			roll_bonus = "+"+roll_bonus;
		}
	}
	else{
		//if its an custom token, give no bonus. But still allow a roll (if it has stats) 
		//if has stats
		roll_bonus = "+"+0;	
	}
	qrm_update_popout()
	return roll_bonus
}
	
function remove_from_quick_roll_menu(token) {
	let id = token.options.id;
	if ($("#quick_roll_area tr[data-target='" + id + "']").length > 0) {
		$("#quick_roll_area tr[data-target='" + id + "']").remove(); // delete token from qrm if there
	}
	window.TOKEN_OBJECTS[token.options.id].in_qrm = undefined;
	qrm_update_popout()
}

function convert_CR_to_proficiency(challenge_rating){
	//Apparently proficinecy bonus isn't stored in the monster data, unless i just missed it. 
	//And this should be significantly faster than having to reread the statblock.
	CR = challenge_rating;
	switch (true) {
		case CR >= 34://CR 29
			prof = 9;
			break;
		case CR >= 30://CR 25 
			prof = 8;
			break;
		case CR >= 25://CR 21
			prof = 7;
			break;
		case CR >= 21://CR 17
			prof = 6;
			break;
		case CR >= 17://CR 13
			prof = 5;
			break;
		case CR >= 13://CR 9 
			prof = 4;
			break;
		case CR >= 9://CR 5
			prof = 3;
			break;
		case CR <= 8://CR <4 
			prof = 2;
			break;
	}
	return prof;
}

function qrm_update_popout(){
	
	if(childWindows['Quick Roll Menu']){
		updatePopoutWindow("Quick Roll Menu", $("#qrm_dialog"));
		removeFromPopoutWindow("Quick Roll Menu", "#quick_roll_title_bar");

		//remove the iconselectmenu, since it won't work in the popout
		removeFromPopoutWindow("Quick Roll Menu", "#qrm_save_dropdown-button");
        removeFromPopoutWindow("Quick Roll Menu", "#qrm_apply_conditions-button")
        $(childWindows['Quick Roll Menu'].document).find(".general_input").css('display', '');

		$(childWindows['Quick Roll Menu'].document).find("#qrm_dialog").css({
			'display': 'block',
			'top': '0',
			'left': '0',
			'right': '0',
			'bottom': '0',
			'width': '100%',
			'height': '100%'
		});
		console.log('Update QRM popout');
		$(childWindows['Quick Roll Menu'].document).find('#qrm_dialog #quick_roll_area input#qrm_hp').change(function(e) {
			let id = $(this).parent().parent().parent().attr("data-target");			
			$(`tr[data-target='${id}'] #qrm_hp`).val($(this).val());
			$(`tr[data-target='${id}'] #qrm_hp`).trigger("change");
			qrm_update_popout();
		});	
		$(childWindows['Quick Roll Menu'].document).find('#qrm_dialog #quick_roll_area input#qrm_maxhp').change(function(e) {
			let id = $(this).parent().parent().parent().attr("data-target");
			$(`tr[data-target='${id}'] #qrm_maxhp`).val($(this).val());
			$(`tr[data-target='${id}'] #qrm_maxhp`).trigger("change");
			qrm_update_popout();
		});	
		$(childWindows['Quick Roll Menu'].document).find('#qrm_dialog #quick_roll_area input#roll_bonus').change(function(e) {
			let id = $(this).parent().parent().parent().attr("data-target");
			console.log($(`tr[data-target='${id}'] #roll_bonus`))
			$(`tr[data-target='${id}'] #roll_bonus`).val($(this).val());
			$(`tr[data-target='${id}'] #roll_bonus`).trigger("change");
			qrm_update_popout();
		});	
		$(childWindows['Quick Roll Menu'].document).find('#qrm_dialog #quick_roll_area input#roll_result').change(function(e) {
			let id = $(this).parent().parent().parent().attr("data-target");
			$(`tr[data-target='${id}'] #roll_result`).val($(this).val());
			$(`tr[data-target='${id}'] #roll_result`).trigger("change");
			qrm_update_popout();
		});	
		$(childWindows['Quick Roll Menu'].document).find('#qrm_dialog #quick_roll_footer input#damage_failed_save').change(function(e) {
			$("#qrm_dialog #quick_roll_footer input#damage_failed_save").val($(this).val());
			$("#qrm_dialog #quick_roll_footer input#damage_failed_save").trigger("change");
			qrm_update_popout();
		});
		$(childWindows['Quick Roll Menu'].document).find('#qrm_dialog #quick_roll_footer input#hp_adjustment_failed_save').change(function(e) {
			$("#qrm_dialog #quick_roll_footer input#hp_adjustment_failed_save").val($(this).val());
			$("#qrm_dialog #quick_roll_footer input#hp_adjustment_failed_save").trigger("change");
			qrm_update_popout();
		});	
		$(childWindows['Quick Roll Menu'].document).find('#qrm_dialog #quick_roll_footer input#half_damage_save').change(function(e) {
			$("#qrm_dialog #quick_roll_footer input#half_damage_save").val($(this).val());
			$('#qrm_dialog #quick_roll_footer input#half_damage_save').trigger("change");
			qrm_update_popout();
		});	
		$(childWindows['Quick Roll Menu'].document).find('#qrm_dialog #quick_roll_footer input#qrm_save_dc').change(function(e) {
			$("#qrm_dialog #quick_roll_footer input#qrm_save_dc").val($(this).val());
			$('#qrm_dialog #quick_roll_footer input#qrm_save_dc').trigger("change");
			qrm_update_popout();
		});			
		$(childWindows['Quick Roll Menu'].document).find('#qrm_dialog #quick_roll_footer select#qrm_save_dropdown').change(function(e) {
			$("#qrm_dialog #quick_roll_footer select#qrm_save_dropdown").find(`option[selected='selected']`).removeAttr('selected');
			$("#qrm_dialog #quick_roll_footer select#qrm_save_dropdown").find(`option[value='${$(this).val()}']`).attr('selected', 'selected');
			$("#qrm_dialog #quick_roll_footer select#qrm_save_dropdown").val($(this).val());
			$('#qrm_dialog #quick_roll_footer select#qrm_save_dropdown').trigger("change");
			save_type_change($("#qrm_save_dropdown"))
			qrm_update_popout();
		});			
		$(childWindows['Quick Roll Menu'].document).find('#qrm_dialog #quick_roll_footer select#qrm_apply_conditions').change(function(e) {
			$("#qrm_dialog #quick_roll_footer select#qrm_apply_conditions").find(`option[selected='selected']`).removeAttr('selected');
			$("#qrm_dialog #quick_roll_footer select#qrm_apply_conditions").find(`option[value='${$(this).val()}']`).attr('selected', 'selected');
			$("#qrm_dialog #quick_roll_footer select#qrm_apply_conditions").val($(this).val());
			$('#qrm_dialog #quick_roll_footer select#qrm_apply_conditions').trigger("change");
			qrm_update_popout();
		});
	
		$(childWindows['Quick Roll Menu'].document).find("#qrm_damage").click(function(){
			let heal_hp = $("#qrm_healing");
			let damage_hp = $("#qrm_damage");
			//toggle off the other button
			$(heal_hp).val("OFF")
			$(heal_hp).removeClass('active_roll_mod')
			
			if($(damage_hp).val() == "ON"){
				$(damage_hp).val("OFF");
				$(damage_hp).removeClass('active_roll_mod')
			}
		  	else if($(damage_hp ).val() == "OFF"){
				$(damage_hp).val("ON");
				$(damage_hp).addClass('active_roll_mod')
			}
			qrm_update_popout();
		});
		$(childWindows['Quick Roll Menu'].document).find("#qrm_healing").click(function(){
			let heal_hp = $("#qrm_healing");
			let damage_hp = $("#qrm_damage");

			//toggle off the other button
			$(damage_hp).val("OFF")
			$(damage_hp).removeClass('active_roll_mod')

			if($(heal_hp).val() == "ON"){
				$(heal_hp).val("OFF");
				$(heal_hp).removeClass('active_roll_mod')
			}
		  	else if($(heal_hp).val() == "OFF"){
				$(heal_hp).val("ON");
				$(heal_hp).addClass('active_roll_mod')
			}
			qrm_update_popout();
		});

		
	}
}

function qrm_apply_hp_adjustment(healing=false){
	if(healing == 'ON'){
		healing = true;
	}
	$("#quick_roll_area").children('tr').each(function (){
		let result = $(this).find('#qrm_roll_result').val();
		if (result == ''){
			//could swap this to an alert if people really think its needed...
			console.log('No roll was performed on this token, but Apply was selected. Rerolling for ALL tokens.')
			$('#qrm_roll_button').click()
		}
		
		let token = window.TOKEN_OBJECTS[$(this).attr('data-target')]
		let hp_adjustment_failed_save = $('#hp_adjustment_failed_save').val()
		let half_damage_save_success = $('#half_damage_save').val()

		hp_adjustment_failed_save = hp_adjustment_failed_save.replace(/[^\d.-]/g, '');
		half_damage_save_success = half_damage_save_success.replace(/[^\d.-]/g, '');

		let damage;
		if (result.includes('Fail')){
			damage = hp_adjustment_failed_save || 0
			let conditions = $('#qrm_apply_conditions')
			let conditionName = conditions.val()
			if(conditionName == 'conditions'){
				//Do nothing
			} 
			else if(conditionName == "remove_all"){
				//guess this is fine, we update the token immediately. Probably a better way to clear though
				token.options.conditions = []
				token.options.custom_conditions = []
			}
			else{
				if(!token.hasCondition(conditionName)){
					token.addCondition(conditionName, conditionName);
				}
			}	
		}
		else {
			damage = half_damage_save_success || 0
		}
		if (healing == true){
			damage = -damage
		}
		
		if(token.options.monster > 0){
			let _hp = $(this).find('#qrm_hp');
			let _max_hp = $(this).find('#qrm_maxhp');

			let _hp_val = parseInt($(this).find('#qrm_hp').val());//make string an int before comparing otherwise '11' is less than '6'
			let _max_hp_val = parseInt($(this).find('#qrm_maxhp').val())
			//Lets not allow healing over maxhp
			//Unless we are at max_hp then assume they want the temp hp? IDK about this.
			if (_hp_val < _max_hp_val && _hp_val - damage > _max_hp_val){
				_hp.val(_max_hp_val);
			}
			else{
				_hp.val(token.hp - damage);
			}
			_hp.trigger('change');
		}
		else {
			// doing it this way, because Players might also have resistances or abilites and they should manage their own HP. 
			let dmg_heal_text;
			if (damage >= 0){
				dmg_heal_text = token.options.name + " takes " + damage +" damage (adjust manually)";
			}
			else{
				dmg_heal_text = token.options.name + " heals for " + damage +" (adjust manually)";
			}
				var msgdata = {
				player: window.PLAYER_NAME,
				img: window.PLAYER_IMG,
				text: dmg_heal_text,
			};
			window.MB.inject_chat(msgdata);
		}
		//token.place_sync_persist();	
		// bit of overlap with place_sync_persist nad update_and_sync, so probably break it up, just to only sync once.
		token.place()
		token.update_and_sync();
		qrm_update_popout();
	});
}

//end Quick Roll Menu//
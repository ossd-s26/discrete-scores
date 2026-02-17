(function() {
	'use strict';

	// Declaring default settings
	let settings = {
		enabled: true,
		mode: 'always', // always, threshold
		threshold: 70,
		apparent:true,
		cumulative: true
	};

	// Load settings
	async function loadSettings() {
		try {
			const result = await browser.storage.local.get('settings');
			if (result.settings) {
				settings = { ...settings, ...result.settings };
			}
		} catch (error) {
			console.error("Error loading settings:", error);
			// we fall back to defaults set above
		}
	}

	// Parse score
	function parseScore(scoreText) {
		const match = scoreText.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
		if (match) {
			const earned = parseFloat(match[1]);
			const total = parseFloat(match[2]);
			return { earned, total, percentage: total > 0 ? (earned / total) * 100 : 0 };
		}
		return null;
	}

 	// Determine if score should be visible
	function shouldHideScore(scoreInfo) {
		if (!settings.enabled) {
			return false;
    	}
		if (settings.mode === 'always') {
			return true;
		}
		if (settings.mode === 'threshold' && scoreInfo) {
			return scoreInfo.percentage < settings.threshold;
		}
		return false;
	}

	// Create buttons
	function createButton(isHidden) {
		const button = document.createElement('button');
		button.className = 'gs-discrete-button';
		button.textContent = isHidden ? 'Show Grade' : 'Hide Grade';
		return button;
	}

	// Create drop score button
	function createDropButton() {
		const button = document.createElement('button');
		button.className = 'gs-discrete-drop-button';
		button.title = 'Drop this score from the total';
		button.textContent = '×';
		return button;
	}

	// Recalculate totals
	function recalculateTotals() {
		const scoreElements = document.querySelectorAll('.submissionStatus--score');
		let totalEarned = 0;
		let totalPossible = 0;

		scoreElements.forEach(scoreElement => {
			const wrapper = scoreElement.querySelector('.gs-discrete-overlay');
			if (!wrapper) return;
	
			const isDropped = wrapper.getAttribute('data-gs-discrete-dropped') === 'true';
			if (isDropped) return;
	
			const scoreDisplay = wrapper.querySelector('.gs-discrete-score-value');
			if (!scoreDisplay) return;
	
			const numeratorEl = scoreDisplay.querySelector('.gs-discrete-numerator');
			const denominatorEl = scoreDisplay.querySelector('.gs-discrete-denominator');
	
			if (numeratorEl && denominatorEl) {
				const earned = parseFloat(numeratorEl.textContent);
				const total = parseFloat(denominatorEl.textContent);
	
				if (!isNaN(earned) && !isNaN(total) && total > 0) {
					totalEarned += earned;
					totalPossible += total;
				}
			} else {
				// Fallback for non-editable scores or text-only scores
				const scoreText = scoreDisplay.textContent.trim();
				if (scoreText.match(/^-\s*\/\s*\d/)) return;
				const scoreInfo = parseScore(scoreText);
				if (scoreInfo && scoreInfo.total > 0) {
					totalEarned += scoreInfo.earned;
					totalPossible += scoreInfo.total;
				}
			}
		});

		let cumulativeGradeContainer = document.querySelector('.gs-cumulative-grade');
		if (settings.cumulative && totalPossible > 0) {
			const cumulativePercentage = (totalEarned / totalPossible) * 100;
			const cumulativeText = `Cumulative Grade: <span>${cumulativePercentage.toFixed(2)}%</span> (${totalEarned.toFixed(2)} / ${totalPossible.toFixed(2)})`;

			if (!cumulativeGradeContainer) {
				const contentWrapper = document.querySelector('.l-content');
				if (contentWrapper) {
					cumulativeGradeContainer = document.createElement('div');
					cumulativeGradeContainer.className = 'gs-cumulative-grade';
					contentWrapper.appendChild(cumulativeGradeContainer);
				}
			}
			if (cumulativeGradeContainer) {
				cumulativeGradeContainer.innerHTML = cumulativeText;
				cumulativeGradeContainer.style.display = '';
			}
		} else if (cumulativeGradeContainer) {
			cumulativeGradeContainer.remove(); 
		}
	}

	function makeEditable(element, scoreDisplay) {
		// Prevent creating a new input if one already exists
		if (scoreDisplay.querySelector('input')) {
			return;
		}
	
		const oldValue = element.textContent;
		const input = document.createElement('input');
		input.type = 'number';
		input.className = 'gs-discrete-score-input';
		input.value = oldValue;
	
		// Replace the span with the input
		element.textContent = '';
		element.appendChild(input);
		input.focus();
		input.select();
	
		const save = () => {
			const newValue = input.value.trim();
			// Restore the original value if the new value is empty or invalid
			if (newValue === '' || isNaN(newValue)) {
				element.removeChild(input);
				element.textContent = oldValue;
			} else {
				element.removeChild(input);
				element.textContent = newValue;
				recalculateTotals();
			}
		};
	
		const cancel = () => {
			element.removeChild(input);
			element.textContent = oldValue;
		};
	
		input.addEventListener('blur', save);
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				save();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				cancel();
			}
		});
	}

	// Process score element
	function processScoreElement(scoreElement) {
		if (scoreElement.hasAttribute('data-gs-discrete-processed')) {
			return;
    	}

		const scoreText = scoreElement.textContent.trim();
	    
		// Skip ungraded assignments
		if (scoreText.match(/^-\s*\/\s*\d/)) return;

		const scoreInfo = parseScore(scoreText);
		const shouldHide = shouldHideScore(scoreInfo);

		scoreElement.setAttribute('data-gs-discrete-processed', 'true');

		// Build UI elems
		const wrapper = document.createElement('div');
		wrapper.className = 'gs-discrete-overlay';
		const scoreDisplay = document.createElement('div');
		scoreDisplay.className = 'gs-discrete-score-value';

		if (scoreInfo) {
			const numerator = document.createElement('span');
			numerator.className = 'gs-discrete-numerator';
			numerator.textContent = scoreInfo.earned;
	
			const separator = document.createElement('span');
			separator.className = 'gs-discrete-separator';
			separator.textContent = ' / ';
	
			const denominator = document.createElement('span');
			denominator.className = 'gs-discrete-denominator';
			denominator.textContent = scoreInfo.total;
	
			scoreDisplay.appendChild(numerator);
			scoreDisplay.appendChild(separator);
			scoreDisplay.appendChild(denominator);
		} else {
			scoreDisplay.textContent = scoreText;
		}

		const toggleButton = createButton(shouldHide);
		const dropButton = createDropButton();

		if (shouldHide) {
			scoreDisplay.classList.add('gs-discrete-hidden');
		}

		scoreElement.innerHTML = '';
		wrapper.appendChild(scoreDisplay);
		wrapper.appendChild(toggleButton);
		wrapper.appendChild(dropButton);
		scoreElement.appendChild(wrapper);

		// Click handler
		toggleButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
	      
			const isCurrentlyHidden = scoreDisplay.classList.contains('gs-discrete-hidden');
			scoreDisplay.classList.toggle('gs-discrete-hidden');
	      
			const newHiddenState = !isCurrentlyHidden;
			toggleButton.textContent = newHiddenState ? 'Show Grade' : 'Hide Grade';
		});

		dropButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			
			const isDropped = wrapper.getAttribute('data-gs-discrete-dropped') === 'true';
	
			if (isDropped) {
				wrapper.removeAttribute('data-gs-discrete-dropped');
				scoreDisplay.classList.remove('gs-discrete-dropped');
				dropButton.classList.remove('active');
			} else {
				wrapper.setAttribute('data-gs-discrete-dropped', 'true');
				scoreDisplay.classList.add('gs-discrete-dropped');
				dropButton.classList.add('active');
			}
			
			recalculateTotals();
		});

		// Click handler for making scores editable
		scoreDisplay.addEventListener('click', (e) => {
			if (e.target.classList.contains('gs-discrete-numerator') || e.target.classList.contains('gs-discrete-denominator')) {
				makeEditable(e.target, scoreDisplay);
			}
		});
	}

	// Process the scores on the page
	function processPage() {
		const url = window.location.href;
		if (url.match(/\/courses\/\d+$/)) {
			// Process individual score elements for hiding/showing
			const scoreElements = document.querySelectorAll('.submissionStatus--score');
			scoreElements.forEach(el => processScoreElement(el));

			recalculateTotals();

			if (settings.apparent) {
	            const warns = document.querySelectorAll(`
	                .submissionStatus-warning .submissionStatus--text, 
	                .submissionTimeChart-warning .submissionTimeChart--timeRemaining
	            `);

	            warns.forEach(elem => {elem.style.textShadow = "0 0 5px #ff8c00, 0 0 10px #ff8c00"});
        	}
		}
	}

	// Initialize extension
	async function init() {
		await loadSettings();
    
		if (!settings.enabled) return;
    
		processPage();
    
		// Watch for live grade updates
		const observer = new MutationObserver((mutations) => {
			clearTimeout(window.gsDiscreteTimeout);
			window.gsDiscreteTimeout = setTimeout(() => {
				if (settings.enabled) processPage();
			}, 100);
		});
		observer.observe(document.body, {childList: true, subtree: true});
	}

 	// Waiting for page to load
 	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
 	} 
	else {
		init();
	}

	// Listen for settings changes
	browser.storage.onChanged.addListener((changes) => {
		if (changes.settings) {
			settings = { ...settings, ...changes.settings.newValue };
			location.reload();
		}
	});
})();
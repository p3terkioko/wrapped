// App State
let currentData = null;
let isAuthenticated = false;
let currentSlide = 0;
let totalSlides = 12;

// DOM Elements (get these dynamically to avoid null reference issues)
const landingPage = document.getElementById('landing-page');
const dashboard = document.getElementById('dashboard');
const loadingScreen = document.getElementById('loading-screen');
const themeToggle = document.getElementById('theme-toggle');
const analyzeBtn = document.getElementById('analyze-btn');
const backBtn = document.getElementById('back-btn');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up app...');
    
    setupEventListeners();
    handleURLParams();
    
    // Enable analyze button since we use cached data
    if (analyzeBtn) {
        analyzeBtn.disabled = false;
    }
    
    // Try to load cached data first
    loadCachedData();
});

// Check authentication status (now simplified)
async function checkAuthStatus() {
    try {
        const response = await fetch('/auth/status', {
            credentials: 'include'
        });
        const data = await response.json();
        isAuthenticated = data.authenticated;
        updateAuthButton();
    } catch (error) {
        console.error('Error checking auth status:', error);
        isAuthenticated = false;
        updateAuthButton();
    }
}

// Update auth button based on status (no longer needed for public access)
function updateAuthButton() {
    // Button is always enabled since we use cached data
    if (analyzeBtn) {
        analyzeBtn.disabled = false;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Theme toggle
    themeToggle?.addEventListener('click', toggleTheme);
      // Analyze button - now just triggers showing cached data
    analyzeBtn?.addEventListener('click', function() {
        if (currentData) {
            showDashboard(currentData);
        } else {
            loadCachedData();
        }
    });
    
    // Back button
    backBtn?.addEventListener('click', () => {
        showLandingPage();
    });
    
    // Share and export buttons
    const shareBtn = document.getElementById('share-btn');
    const exportBtn = document.getElementById('export-btn');
    const advancedAnalyticsBtn = document.getElementById('advanced-analytics-btn');
    
    if (shareBtn) shareBtn.addEventListener('click', shareResults);
    if (exportBtn) exportBtn.addEventListener('click', exportResults);
    if (advancedAnalyticsBtn) {
        advancedAnalyticsBtn.addEventListener('click', () => {
            console.log('🔍 Manual advanced analytics trigger');
            loadAdvancedAnalytics();
        });
    }
}

// Handle URL parameters
function handleURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const auth = urlParams.get('auth');
    
    if (error) {
        showError('Authentication failed. Please try again.');
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (auth === 'success') {
        showSuccess('Successfully logged in with Spotify!');
        checkAuthStatus();
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Authentication functions
function login() {
    window.location.href = '/auth/login';
}

async function logout() {
    try {
        await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        isAuthenticated = false;
        updateAuthButton();
        showSuccess('Successfully logged out.');
    } catch (error) {
        console.error('Logout error:', error);
        showError('Error logging out. Please try again.');
    }
}

// Theme toggle
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    const icon = themeToggle.querySelector('i');
    icon.className = newTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
}

// Load saved theme
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const icon = themeToggle.querySelector('i');
    icon.className = savedTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
}

// Validate Spotify playlist URL
function validatePlaylistURL() {
    const url = playlistInput.value.trim();
    const isValid = isValidSpotifyPlaylistURL(url);
    
    if (isValid && isAuthenticated) {
        analyzeBtn.disabled = false;
        playlistInput.style.borderColor = 'var(--accent-primary)';
    } else {
        analyzeBtn.disabled = true;
        playlistInput.style.borderColor = url ? 'var(--error-color, #ff4444)' : 'var(--card-border)';
    }
}

// Check if URL is a valid Spotify playlist URL
function isValidSpotifyPlaylistURL(url) {
    const spotifyPlaylistRegex = /https?:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/;
    return spotifyPlaylistRegex.test(url);
}

// Extract playlist ID from URL
function extractPlaylistId(url) {
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

// Analyze playlist
async function analyzePlaylist() {
    // Use the hardcoded playlist ID
    const playlistId = '1BZY7mhShLhc2fIlI6uIa4';
    
    if (!isAuthenticated) {
        showError('Please login with Spotify first.');
        return;
    }
    
    showLoading();
    
    try {
        const accessToken = getCookie('spotify_access_token');
        
        const response = await fetch('/api/playlist/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playlistId: playlistId,
                accessToken: accessToken
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to analyze playlist');
        }
        
        const data = await response.json();
        currentData = data;
        
        hideLoading();
        showDashboard(data);
        
    } catch (error) {
        console.error('Analysis error:', error);
        hideLoading();
        showError('Failed to analyze playlist. Please try again.');
    }
}

// Get cookie value
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Show loading screen
function showLoading() {
    loadingScreen.classList.remove('hidden');
}

// Hide loading screen
function hideLoading() {
    loadingScreen.classList.add('hidden');
}

// Show landing page
function showLandingPage() {
    dashboard.classList.add('hidden');
    landingPage.classList.remove('hidden');
}

// Show dashboard with data
function showDashboard(data) {
    landingPage.classList.add('hidden');
    dashboard.classList.remove('hidden');
    
    populateDashboard(data);
    
    // Ensure story button is working after dashboard is shown
    setTimeout(() => {
        setupViewStoryButton();
    }, 100);
}

// Separate function to setup view story button
function setupViewStoryButton() {
    const viewStoryBtn = document.getElementById('view-story-btn');
    console.log('Setting up view story button:', !!viewStoryBtn);
    
    if (viewStoryBtn) {
        // Remove any existing listeners
        const newBtn = viewStoryBtn.cloneNode(true);
        viewStoryBtn.parentNode.replaceChild(newBtn, viewStoryBtn);
        
        // Add fresh event listener
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('View Story button clicked!');
            console.log('Current data exists:', !!currentData);
            
            if (currentData) {
                showStory();
            } else {
                alert('No playlist data available!');
            }
        });
        
        console.log('✅ View story button setup complete');
    } else {
        console.log('❌ View story button not found in DOM');
    }
}

// Populate dashboard with playlist data
function populateDashboard(data) {
    // Playlist overview
    document.getElementById('playlist-img').src = data.playlist.image || '/placeholder-playlist.png';
    document.getElementById('playlist-name').textContent = data.playlist.name;
    document.getElementById('playlist-description').textContent = data.playlist.description || 'No description available';
    document.getElementById('total-tracks').textContent = data.playlist.totalTracks.toLocaleString();
    document.getElementById('total-followers').textContent = data.playlist.followers.toLocaleString();
    document.getElementById('playlist-owner').textContent = data.playlist.owner;
    
    // Top artists
    populateArtists(data.topArtists);
    
    // Top contributors
    populateContributors(data.topContributors);
    
    // Most popular track
    populateTrackInfo('popular-track', data.mostPopular, 'Most Popular');
    
    // Hidden gem
    populateTrackInfo('hidden-gem', data.leastPopular, 'Hidden Gem');
      // Timeline
    populateTimeline(data.dateRange);
    
    // Oldest & Newest Songs
    populateOldestNewestSongs(data);
    
    // Charts
    createGenresChart(data.topGenres);
    createMoodChart(data.audioFeatures);    // Load advanced analytics - use existing comprehensive data if available
    if (data.contributors) {
        console.log('✅ Using existing comprehensive contributor analytics');
        console.log('Contributors data structure:', data.contributors);
        console.log('Contributors array length:', data.contributors.contributors?.length || 0);
        populateContributorAnalytics(data.contributors);
    } else {
        console.log('📊 Loading advanced analytics separately...');
        loadAdvancedAnalytics();
    }
    
    // Load genre maestros and playlist members if available in data
    if (data.genreMaestros) {
        console.log('✅ Using existing genre maestros data');
        populateGenreMaestros(data.genreMaestros);
    }
    
    if (data.playlistMembers) {
        console.log('✅ Using existing playlist members data');
        populatePlaylistMembers(data.playlistMembers);
    }
    
    // If not available in main data, load them separately
    if (!data.genreMaestros || !data.playlistMembers) {
        console.log('📊 Loading members and champions separately...');
        loadMembersAndChampions();
    }
}

// Populate artists list
function populateArtists(artists) {
    const container = document.getElementById('artists-list');
    container.innerHTML = '';
    
    artists.forEach((artist, index) => {
        const artistElement = document.createElement('div');
        artistElement.className = 'artist-item';
        artistElement.innerHTML = `
            <span class="artist-name">${index + 1}. ${artist.name}</span>
            <span class="artist-count">${artist.count} tracks</span>
        `;
        container.appendChild(artistElement);
    });
}

// Populate contributors list
function populateContributors(contributors) {
    const container = document.getElementById('contributors-list');
    container.innerHTML = '';
    
    contributors.forEach((contributor, index) => {
        const contributorElement = document.createElement('div');
        contributorElement.className = 'contributor-item';
        contributorElement.innerHTML = `
            <span class="contributor-name">${index + 1}. ${contributor.displayName}</span>
            <span class="contributor-count">${contributor.count} songs</span>
        `;
        container.appendChild(contributorElement);
    });
}

// Populate track info
function populateTrackInfo(containerId, track, type) {
    const container = document.getElementById(containerId);
    
    if (!track) {
        container.innerHTML = '<p>No data available</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="track-name">${track.name}</div>
        <div class="track-artist">${track.artists}</div>
        <div class="track-popularity">${track.popularity}% popularity</div>
        ${track.external_urls?.spotify ? `
            <a href="${track.external_urls.spotify}" target="_blank" class="spotify-link">
                <i class="fab fa-spotify"></i>
                Listen on Spotify
            </a>
        ` : ''}
    `;
}

// Populate timeline
function populateTimeline(dateRange) {
    const container = document.getElementById('timeline-info');
    
    if (!dateRange) {
        container.innerHTML = '<p>No timeline data available</p>';
        return;
    }
    
    const earliest = new Date(dateRange.earliest).toLocaleDateString();
    const latest = new Date(dateRange.latest).toLocaleDateString();
    const duration = Math.ceil((new Date(dateRange.latest) - new Date(dateRange.earliest)) / (1000 * 60 * 60 * 24));
    
    container.innerHTML = `
        <div class="timeline-dates">
            <div class="timeline-date">
                <span class="date-label">First Added</span>
                <span class="date-value">${earliest}</span>
            </div>
            <div class="timeline-date">
                <span class="date-label">Last Added</span>
                <span class="date-value">${latest}</span>
            </div>
        </div>        <div class="timeline-duration">
            Playlist built over ${duration} days
        </div>
    `;
}

// Populate oldest and newest songs
function populateOldestNewestSongs(data) {
    const container = document.getElementById('oldest-newest-info');
    
    if (!container) {
        console.log('oldest-newest-info container not found');
        return;
    }
    
    // Find oldest and newest songs from contributor data
    let oldestSong = null;
    let newestSong = null;
    
    if (data.contributors && data.contributors.contributors) {
        data.contributors.contributors.forEach(contributor => {
            if (contributor.tracks) {
                contributor.tracks.forEach(track => {
                    if (track.releaseDate) {
                        if (!oldestSong || track.releaseDate < oldestSong.releaseDate) {
                            oldestSong = track;
                        }
                        if (!newestSong || track.releaseDate > newestSong.releaseDate) {
                            newestSong = track;
                        }
                    }
                });
            }
        });
    }
    
    if (!oldestSong || !newestSong) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No release date information available</p>';
        return;
    }
    
    const oldestYear = new Date(oldestSong.releaseDate).getFullYear();
    const newestYear = new Date(newestSong.releaseDate).getFullYear();
    const yearSpan = newestYear - oldestYear;
    
    container.innerHTML = `
        <div class="oldest-newest-track oldest">
            <span class="track-type">Oldest Track</span>
            <div class="track-name">${oldestSong.name}</div>
            <div class="track-artist">${oldestSong.artists}</div>
            <span class="track-year">${oldestYear}</span>
        </div>
        <div class="oldest-newest-track newest">
            <span class="track-type">Newest Track</span>
            <div class="track-name">${newestSong.name}</div>
            <div class="track-artist">${newestSong.artists}</div>
            <span class="track-year">${newestYear}</span>
        </div>
    `;
    
    // Add a summary if there's a significant time span
    if (yearSpan > 10) {
        const summaryDiv = document.createElement('div');
        summaryDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; margin-top: 16px; color: var(--text-secondary); font-size: 14px;';
        summaryDiv.innerHTML = `<i class="fas fa-history"></i> This playlist spans <strong>${yearSpan} years</strong> of musical history`;
        container.appendChild(summaryDiv);
    }
}

// Create genres chart
function createGenresChart(genres) {
    const ctx = document.getElementById('genres-chart').getContext('2d');
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: genres.map(g => g.genre),
            datasets: [{
                data: genres.map(g => g.count),
                backgroundColor: [
                    '#1db954', '#1ed760', '#ff6b6b', '#4ecdc4',
                    '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b'
                ],
                borderWidth: 0
            }]
        },        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff',
                        usePointStyle: true,
                        padding: 25,
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });
}

// Create mood chart
function createMoodChart(audioFeatures) {
    const ctx = document.getElementById('mood-chart').getContext('2d');
    
    const features = [
        { label: 'Valence', value: audioFeatures.valence },
        { label: 'Energy', value: audioFeatures.energy },
        { label: 'Danceability', value: audioFeatures.danceability },
        { label: 'Acousticness', value: audioFeatures.acousticness },
        { label: 'Speechiness', value: audioFeatures.speechiness }
    ];
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: features.map(f => f.label),
            datasets: [{
                label: 'Playlist Mood',
                data: features.map(f => f.value),
                backgroundColor: 'rgba(29, 185, 84, 0.2)',
                borderColor: '#1db954',
                borderWidth: 2,
                pointBackgroundColor: '#1db954',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: {
                        color: 'var(--card-border)'
                    },
                    grid: {
                        color: 'var(--card-border)'
                    },
                    pointLabels: {
                        color: 'var(--text-primary)'
                    },
                    ticks: {
                        color: 'var(--text-secondary)',
                        backdropColor: 'transparent'
                    },
                    min: 0,
                    max: 1
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: 'var(--text-primary)'
                    }
                }
            }
        }    });
}

// Populate advanced analytics sections
function populateAdvancedAnalytics(analyticsData) {
    if (!analyticsData) return;
      // Populate contributor analytics
    if (analyticsData.contributors) {
        populateContributorAnalytics(analyticsData.contributors);
    }
}

function populateContributorAnalytics(contributorData) {
    console.log('🔍 populateContributorAnalytics called with:', contributorData);
    
    // Temporary debugging - show structure
    if (contributorData && contributorData.contributors && contributorData.contributors.length > 0) {
        const firstContributor = contributorData.contributors[0];
        console.log('✅ First contributor found:', firstContributor.name, 'with', firstContributor.tracksAdded, 'tracks');
    } else {
        console.log('❌ No valid contributors found in data');
        console.log('contributorData:', contributorData);
    }
    
    const container = document.getElementById('contributor-analytics');
    if (!container) {
        console.log('❌ contributor-analytics container not found');
        return;
    }
    
    // contributorData is the full analytics object with contributors array inside
    const contributors = contributorData.contributors || [];
    console.log('📊 Contributors array:', contributors);
    console.log('📊 First contributor:', contributors[0]);
    
    const totalTracks = contributors.reduce((sum, c) => sum + (c.tracksAdded || 0), 0);
    console.log('📊 Total tracks from contributors:', totalTracks);
    
    container.innerHTML = `
        <div class="contributor-leaderboard">            ${contributors.slice(0, 8).map((contributor, index) => {
                const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
                const isTop = index < 3;
                const tracksAdded = contributor.tracksAdded || 0;
                const percentage = totalTracks > 0 ? Math.round((tracksAdded / totalTracks) * 100) : 0;
                
                return `
                    <div class="contributor-leader ${isTop ? 'top' : ''}">
                        <div class="contributor-info">
                            <div class="contributor-rank ${rankClass}">${index + 1}</div>
                            <div class="contributor-details">
                                <div class="contributor-name">${contributor.name || 'Unknown User'}</div>
                                <div class="contributor-stats">
                                    <div class="stat-item">
                                        <span class="stat-value">${tracksAdded}</span>
                                        <span class="stat-label">songs</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-value">${percentage}%</span>
                                        <span class="stat-label">of playlist</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-value">${contributor.genreDiversity || 0}</span>
                                        <span class="stat-label">genres</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-value">${Math.round(contributor.avgPopularity || 0)}</span>
                                        <span class="stat-label">avg popularity</span>
                                    </div>
                                </div>
                                ${contributor.badges && contributor.badges.length > 0 ? `
                                    <div class="contributor-badges">
                                        ${contributor.badges.map(badge => `
                                            <span class="badge special" title="${badge.description}">
                                                ${badge.name}
                                            </span>
                                        `).join('')}
                                    </div>
                                ` : ''}
                                ${contributor.avgAudioFeatures && (
                                    contributor.avgAudioFeatures.energy > 0 || 
                                    contributor.avgAudioFeatures.danceability > 0 || 
                                    contributor.avgAudioFeatures.valence > 0
                                ) ? `
                                    <div class="contributor-audio-features">
                                        <div class="audio-feature-bar">
                                            <span class="feature-label">⚡ Energy</span>
                                            <div class="feature-bar">
                                                <div class="feature-fill" style="width: ${contributor.avgAudioFeatures.energy * 100}%"></div>
                                            </div>
                                            <span class="feature-value">${Math.round(contributor.avgAudioFeatures.energy * 100)}%</span>
                                        </div>
                                        <div class="audio-feature-bar">
                                            <span class="feature-label">💃 Dance</span>
                                            <div class="feature-bar">
                                                <div class="feature-fill" style="width: ${contributor.avgAudioFeatures.danceability * 100}%"></div>
                                            </div>
                                            <span class="feature-value">${Math.round(contributor.avgAudioFeatures.danceability * 100)}%</span>
                                        </div>
                                        <div class="audio-feature-bar">
                                            <span class="feature-label">🌈 Mood</span>
                                            <div class="feature-bar">
                                                <div class="feature-fill" style="width: ${contributor.avgAudioFeatures.valence * 100}%"></div>
                                            </div>
                                            <span class="feature-value">${Math.round(contributor.avgAudioFeatures.valence * 100)}%</span>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        ${contributorData.summary ? `
            <div class="contributor-summary">
                <div class="summary-stats">
                    <div class="summary-stat">
                        <span class="summary-value">${contributorData.totalContributors}</span>
                        <span class="summary-label">Total Contributors</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-value">${contributorData.summary.avgContribution}</span>
                        <span class="summary-label">Avg Songs/Person</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-value">${contributorData.summary.totalGenres}</span>
                        <span class="summary-label">Total Genres</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-value">${contributorData.summary.totalArtists || 0}</span>
                        <span class="summary-label">Total Artists</span>
                    </div>
                </div>                <div class="summary-highlight">
                    <i class="fas fa-crown"></i>
                    <span>Most Active: <strong>${contributorData.summary.mostActive}</strong></span>
                </div>
            </div>
        ` : ''}
        
        <!-- Badge Legend -->
        <div class="badge-legend">
            <div class="legend-header">
                <h4><i class="fas fa-info-circle"></i> Badge Guide</h4>
                <p>Understanding contributor achievements</p>
            </div>
            <div class="legend-grid">
                <div class="legend-category">
                    <h5>🏆 Contribution Badges</h5>
                    <div class="legend-items">
                        <div class="legend-item">
                            <span class="badge-preview">🔥 Top Curator</span>
                            <span class="badge-description">Added the most tracks to this playlist</span>
                        </div>
                        <div class="legend-item">
                            <span class="badge-preview">🧠 Eclectic Ear</span>
                            <span class="badge-description">Most diverse taste with widest genre spread</span>
                        </div>
                        <div class="legend-item">
                            <span class="badge-preview">🎖️ Genre Guru</span>
                            <span class="badge-description">Master of a specific genre</span>
                        </div>
                        <div class="legend-item">
                            <span class="badge-preview">📀 Collector</span>
                            <span class="badge-description">Music explorer with most unique artists</span>
                        </div>
                    </div>
                </div>
                
                <div class="legend-category">
                    <h5>🔍 Discovery Badges</h5>
                    <div class="legend-items">
                        <div class="legend-item">
                            <span class="badge-preview">🌚 Underground Hero</span>
                            <span class="badge-description">Discovers hidden gems with low popularity</span>
                        </div>
                        <div class="legend-item">
                            <span class="badge-preview">📈 Trendsetter</span>
                            <span class="badge-description">Early adopter of tracks before they're popular</span>
                        </div>
                        <div class="legend-item">
                            <span class="badge-preview">💿 Old Soul</span>
                            <span class="badge-description">Loves classics with oldest average release year</span>
                        </div>
                        <div class="legend-item">
                            <span class="badge-preview">🆕 Fresh Dropper</span>
                            <span class="badge-description">Always current with newest releases</span>
                        </div>
                    </div>
                </div>
                
                <div class="legend-category">
                    <h5>🎵 Vibe Badges</h5>
                    <div class="legend-items">
                        <div class="legend-item">
                            <span class="badge-preview">⚡ Energy Dealer</span>
                            <span class="badge-description">High-energy music curator</span>
                        </div>
                        <div class="legend-item">
                            <span class="badge-preview">💃 Dancefloor Commander</span>
                            <span class="badge-description">Makes everyone move with danceable tracks</span>
                        </div>
                        <div class="badge-preview">🌈 Vibes Master</div>
                        <div class="badge-description">Spreads positive energy with uplifting songs</div>
                        <div class="legend-item">
                            <span class="badge-preview">🌧️ Sad Boi</span>
                            <span class="badge-description">Embraces melancholy with emotional tracks</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Share results
function shareResults() {
    if (!currentData) return;
    
    const shareText = `Check out my Playlist Wrapped for "${currentData.playlist.name}"! 🎵\n\nTop Artist: ${currentData.topArtists[0]?.name}\nMost Popular Track: ${currentData.mostPopular?.name}\n\nAnalyze your own playlists at: ${window.location.origin}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'My Playlist Wrapped',
            text: shareText,
            url: window.location.origin
        });
    } else {
        // Fallback - copy to clipboard
        navigator.clipboard.writeText(shareText).then(() => {
            showSuccess('Share text copied to clipboard!');
        }).catch(() => {
            showError('Failed to copy share text.');
        });
    }
}

// Export results (basic implementation)
function exportResults() {
    if (!currentData) return;
    
    const dataStr = JSON.stringify(currentData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentData.playlist.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_wrapped.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showSuccess('Playlist data exported successfully!');
}

// Utility functions for notifications
function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '16px 24px',
        borderRadius: '8px',
        color: 'white',
        fontWeight: '500',
        zIndex: '10000',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        backgroundColor: type === 'success' ? '#1db954' : '#ff4444'
    });
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// ==============================================
// PLAYLIST WRAPPED STORY MODE IMPLEMENTATION
// ==============================================

let storyCurrentSlide = 0;
const TOTAL_STORY_SLIDES = 12;
let storyData = null;
let touchStartX = 0;
let touchStartY = 0;

// Story Slide Templates
const STORY_SLIDES = [
    'welcome',
    'genre-diversity', 
    'top-artists',
    'most-popular-track',
    'hidden-gem',
    'contributions',
    'genre-champions',
    'timeline',
    'vibe-check',
    'music-time-span',
    'summary',
    'outro'
];

// Main Story Functions
function showStory() {
    console.log('🎬 Launching Playlist Wrapped Story Mode');
    
    if (!currentData) {
        showNotification('No playlist data available for story mode', 'error');
        return;
    }
    
    storyData = currentData;
    storyCurrentSlide = 0;
    
    // Debug: Log the data structure to understand what's available
    console.log('📊 Story data structure:', {
        playlist: storyData.playlist,
        topGenres: storyData.topGenres?.slice(0, 3),
        topArtists: storyData.topArtists?.slice(0, 3),
        topContributors: storyData.topContributors?.slice(0, 3),
        mostPopular: storyData.mostPopular,
        leastPopular: storyData.leastPopular,
        audioFeatures: storyData.audioFeatures
    });
    
    // Show story container
    const storyContainer = document.getElementById('story-container');
    const dashboard = document.getElementById('dashboard');
    
    if (storyContainer && dashboard) {
        storyContainer.classList.remove('hidden');
        dashboard.classList.add('hidden');
        
        // Generate all story slides
        generateAllStorySlides();
        
        // Initialize story UI
        initializeStoryUI();
        
        // Setup story navigation
        setupStoryNavigation();
        
        // Show first slide
        showStorySlide(0);
        
        console.log('✅ Story mode activated');
    }
}

function exitStory() {
    console.log('👋 Exiting story mode');
    
    const storyContainer = document.getElementById('story-container');
    const dashboard = document.getElementById('dashboard');
    
    if (storyContainer && dashboard) {
        storyContainer.classList.add('hidden');
        dashboard.classList.remove('hidden');
    }
}

function generateAllStorySlides() {
    const slidesContainer = document.getElementById('story-slides');
    if (!slidesContainer) return;
    
    const slides = STORY_SLIDES.map((slideType, index) => {
        return generateStorySlide(slideType, index);
    });
    
    slidesContainer.innerHTML = slides.join('');
}

function generateStorySlide(slideType, index) {
    const slideContent = getSlideContent(slideType);
    
    return `
        <div class="story-slide" data-slide="${index}">
            <div class="story-slide-content">
                ${slideContent}
            </div>
            ${slideType === 'outro' ? generateConfetti() : ''}
        </div>
    `;
}

function getSlideContent(slideType) {
    switch (slideType) {
        case 'welcome':
            return generateWelcomeSlideContent();
        case 'genre-diversity':
            return generateGenreDiversitySlideContent();
        case 'top-artists':
            return generateTopArtistsSlideContent();
        case 'most-popular-track':
            return generateMostPopularTrackSlideContent();
        case 'hidden-gem':
            return generateHiddenGemSlideContent();
        case 'contributions':
            return generateContributionsSlideContent();
        case 'genre-champions':
            return generateGenreChampionsSlideContent();
        case 'timeline':
            return generateTimelineSlideContent();
        case 'vibe-check':
            return generateVibeCheckSlideContent();
        case 'music-time-span':
            return generateMusicTimeSpanSlideContent();
        case 'summary':
            return generateSummarySlideContent();
        case 'outro':
            return generateOutroSlideContent();
        default:
            return '<h2>Coming Soon</h2><p>This slide is being crafted...</p>';
    }
}

// Individual Slide Content Generators
function generateWelcomeSlideContent() {
    const playlistName = storyData.playlist?.name || 'Your Playlist';
    const totalTracks = storyData.playlist?.totalTracks || 0;
    
    return `
        <h1>✨ Welcome to the story of</h1>
        <h2 class="story-highlight">${playlistName}</h2>
        <p>Where melodies meet memories and beats become stories</p>
        <div class="story-visual">
            <div class="story-big-number">${totalTracks}</div>
            <p>songs waiting to whisper their secrets</p>
        </div>
        <p style="font-size: 16px; margin-top: 24px;">Press next to begin the journey ➡️</p>
    `;
}

function generateGenreDiversitySlideContent() {
    const genres = storyData.topGenres || [];
    const genreCount = storyData.contributors?.[0]?.summary?.totalGenres || genres.length;
    
    const topGenres = genres.slice(0, 5);
    const colors = ['#1db954', '#ff6b6b', '#4ecdc4', '#f093fb', '#667eea'];
    
    return `
        <h1>� A tapestry woven from</h1>
        <div class="story-big-number">${genreCount}</div>
        <h2>musical worlds</h2>
        <p>Where boundaries blur and creativity flows</p>
        <div class="story-visual">
            <div class="story-doughnut-chart" id="genre-doughnut">
                <!-- Chart will be rendered here -->
            </div>
            <div class="story-genre-list">
                ${topGenres.map((genre, index) => `
                    <div class="story-genre-item">
                        <div class="story-genre-color" style="background: ${colors[index]}"></div>
                        <span>${genre.genre}</span>
                        <small>${genre.count} tracks</small>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function generateTopArtistsSlideContent() {
    const artists = storyData.topArtists || [];
    const topArtists = artists.slice(0, 5);
    
    return `
        <h1>� These voices painted</h1>
        <h2>your soundtrack</h2>
        <p>The storytellers behind every rhythm and rhyme</p>
        <div class="story-visual">
            <div class="story-artists-grid">
                ${topArtists.map((artist, index) => `
                    <div class="story-artist-card">
                        <div class="story-artist-rank">#${index + 1}</div>
                        <div class="story-artist-name">${artist.name}</div>
                        <div class="story-artist-count">${artist.count} tracks</div>
                        <div class="story-artist-bar">
                            <div class="story-artist-fill" style="width: ${(artist.count / topArtists[0].count) * 100}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function generateMostPopularTrackSlideContent() {
    const mostPopular = storyData.mostPopular;
    
    if (!mostPopular) {
        return `
            <h1>� Every note here</h1>
            <h2>shines equally bright</h2>
            <p>In this collection, there are no favorites—only masterpieces ✨</p>
            <div class="story-visual">
                <div class="story-track-spotlight">
                    <div class="story-equality-message">
                        <i class="fas fa-heart" style="font-size: 48px; color: var(--story-accent-primary); margin-bottom: 16px;"></i>
                        <p>All tracks loved equally</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    return `
        <h1>👑 One song captured hearts</h1>
        <div class="story-visual">
            <div class="story-track-spotlight">
                <div class="story-track-info">
                    <div class="story-track-name">"${mostPopular.name}"</div>
                    <div class="story-track-artist">by ${mostPopular.artists}</div>
                    <div class="story-popularity-section">
                        <div class="story-popularity-bar">
                            <div class="story-popularity-fill" style="width: ${mostPopular.popularity}%"></div>
                        </div>
                        <p class="story-popularity-text">
                            ${mostPopular.popularity}/100 popularity score
                        </p>
                    </div>
                </div>
            </div>
        </div>
        <p>The undisputed champion of this musical realm</p>
    `;
}

function generateHiddenGemSlideContent() {
    const leastPopular = storyData.leastPopular;
    
    if (!leastPopular) {
        return `
            <h1>💎 This collection</h1>
            <h2>is pure gold</h2>
            <p>Every track sparkles—no hidden gems needed when everything shimmers ✨</p>
        `;
    }
    
    return `
        <h1>� A treasure waiting</h1>
        <h2>to be discovered</h2>
        <div class="story-visual">
            <div class="story-track-spotlight story-shimmer">
                <div class="story-track-info">
                    <div class="story-track-name">"${leastPopular.name}"</div>
                    <div class="story-track-artist">by ${leastPopular.artists}</div>
                    <div class="story-gem-badge">
                        <i class="fas fa-gem"></i>
                        Hidden Gem
                    </div>
                    <div class="story-popularity-section">
                        <div class="story-popularity-bar">
                            <div class="story-popularity-fill" style="width: ${Math.max(leastPopular.popularity, 5)}%; background: var(--story-accent-secondary);"></div>
                        </div>
                        <p class="story-popularity-text">
                            The most underrated masterpiece
                        </p>
                    </div>
                </div>
            </div>
        </div>
        <p>Sometimes the most precious gems lie beneath the surface</p>
    `;
}

function generateContributionsSlideContent() {
    const contributorsData = storyData.contributors;
    const topContributors = contributorsData?.contributors || [];
    const totalTracks = storyData.playlist?.totalTracks || 0;
    
    if (!topContributors || topContributors.length === 0) {
        return `
            <h1>👥 A collaborative</h1>
            <h2>symphony</h2>
            <p>Where voices unite to craft the perfect playlist</p>
            <div class="story-visual">
                <div class="story-collaboration-icon">
                    <i class="fas fa-users" style="font-size: 64px; color: var(--story-accent-primary);"></i>
                </div>
            </div>
        `;
    }

    const topContributor = topContributors[0];
    const contributorCount = topContributors.length;
    const otherContributors = topContributors.slice(1, 6); // Show up to 5 other curators

    return `
        <h1>👥 ${contributorCount} curators</h1>
        <h2>shaped this journey</h2>
        <p>Each adding their unique musical fingerprint</p>
        <div class="story-visual">
            <div class="story-contribution-spotlight">
                <div class="story-top-contributor">
                    <div class="story-contributor-crown">👑</div>
                    <div class="story-big-number">${topContributor.tracksAdded || 0}</div>
                    <p>tracks by the lead curator</p>
                </div>
            </div>
            ${otherContributors.length > 0 ? `
                <div class="story-other-curators">
                    <div class="story-other-curators-title">Other Contributing Curators</div>
                    <div class="story-curators-list">
                        ${otherContributors.map((contributor, index) => `
                            <div class="story-curator-item">
                                <div class="story-curator-number">${contributor.tracksAdded || 0}</div>
                                <div class="story-curator-label">Curator ${index + 2}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function generateGenreChampionsSlideContent() {
    const topGenres = storyData.topGenres || [];
    const topGenre = topGenres[0];
    
    if (!topGenre) {
        return `
            <h1>🎭 Every genre</h1>
            <h2>has its moment</h2>
            <p>A beautiful symphony of musical diversity</p>
            <div class="story-visual">
                <div class="story-equality-message">
                    <i class="fas fa-balance-scale" style="font-size: 48px; color: var(--story-accent-primary);"></i>
                    <p>Perfect harmony across all styles</p>
                </div>
            </div>
        `;
    }
    
    const genreTitle = getGenreTitle(topGenre.genre);
    const secondGenre = topGenres[1];
    const thirdGenre = topGenres[2];
    
    return `
        <h1>🎭 The genre throne belongs to</h1>
        <h2 class="story-highlight">${topGenre.genre}</h2>
        <p>Ruling with ${topGenre.count} magnificent tracks</p>
        <div class="story-visual">
            <div class="story-genre-podium">
                <div class="story-podium-place" style="order: 2;">
                    <div class="story-podium-rank">#1</div>
                    <div class="story-podium-genre">${topGenre.genre}</div>
                    <div class="story-podium-count">${topGenre.count}</div>
                </div>
                ${secondGenre ? `
                    <div class="story-podium-place" style="order: 1;">
                        <div class="story-podium-rank">#2</div>
                        <div class="story-podium-genre">${secondGenre.genre}</div>
                        <div class="story-podium-count">${secondGenre.count}</div>
                    </div>
                ` : ''}
                ${thirdGenre ? `
                    <div class="story-podium-place" style="order: 3;">
                        <div class="story-podium-rank">#3</div>
                        <div class="story-podium-genre">${thirdGenre.genre}</div>
                        <div class="story-podium-count">${thirdGenre.count}</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function generateTimelineSlideContent() {
    const dateRange = storyData.dateRange;
    
    if (!dateRange || !dateRange.earliest || !dateRange.latest) {
        return `
            <h1>🕰️ This playlist</h1>
            <h2>transcends time</h2>
            <p>A timeless collection where every moment matters</p>
            <div class="story-visual">
                <div class="story-timeline-info">
                    <i class="fas fa-infinity" style="font-size: 64px; color: var(--story-accent-primary); margin: 24px 0;"></i>
                    <p>Infinite musical possibilities</p>
                </div>
            </div>
        `;
    }
    
    const startDate = new Date(dateRange.earliest);
    const endDate = new Date(dateRange.latest);
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    let timeDescription = '';
    if (daysDiff < 30) {
        timeDescription = `${daysDiff} days of music curation`;
    } else if (daysDiff < 365) {
        const months = Math.floor(daysDiff / 30);
        timeDescription = `${months} month${months !== 1 ? 's' : ''} of musical evolution`;
    } else {
        const years = Math.floor(daysDiff / 365);
        timeDescription = `${years} year${years !== 1 ? 's' : ''} of sonic adventures`;
    }
    
    return `
        <h1>🕰️ This playlist grew from</h1>
        <h2>${startMonth}</h2>
        <h1>to</h1>
        <h2>${endMonth}</h2>
        <div class="story-visual">
            <div class="story-timeline-visual">
                <div class="story-timeline-point start">
                    <div class="story-timeline-dot"></div>
                    <div class="story-timeline-label">Journey begins</div>
                </div>
                <div class="story-timeline-line"></div>
                <div class="story-timeline-point end">
                    <div class="story-timeline-dot"></div>
                    <div class="story-timeline-label">Still growing</div>
                </div>
            </div>
            <div class="story-timeline-summary">
                <p>${timeDescription}</p>
            </div>
        </div>
    `;
}

function generateVibeCheckSlideContent() {
    const audioFeatures = storyData.audioFeatures || {};
    const energy = Math.round((audioFeatures.energy || 0.5) * 100);
    const valence = Math.round((audioFeatures.valence || 0.5) * 100);
    const danceability = Math.round((audioFeatures.danceability || 0.5) * 100);
    const acousticness = Math.round((audioFeatures.acousticness || 0.5) * 100);
    
    // Determine the overall vibe
    let vibeDescription = '';
    let vibeEmoji = '�';
    
    if (energy >= 70 && valence >= 70) {
        vibeDescription = 'Pure euphoria flows through every beat';
        vibeEmoji = '⚡';
    } else if (energy >= 70 && valence < 50) {
        vibeDescription = 'Intense emotions burn bright';
        vibeEmoji = '🔥';
    } else if (energy < 50 && valence >= 70) {
        vibeDescription = 'Gentle waves of happiness';
        vibeEmoji = '🌊';
    } else if (acousticness >= 60) {
        vibeDescription = 'Raw, intimate moments captured';
        vibeEmoji = '🎸';
    } else {
        vibeDescription = 'A perfect balance of heart and soul';
        vibeEmoji = '💫';
    }
    
    return `
        <h1>${vibeEmoji} The sonic fingerprint</h1>
        <h2>reveals everything</h2>
        <p>${vibeDescription}</p>
        <div class="story-visual">
            <div class="story-vibe-radar">
                <div class="story-vibe-bars">
                    <div class="story-vibe-bar">
                        <div class="story-vibe-label">Energy</div>
                        <div class="story-vibe-track">
                            <div class="story-vibe-fill energy" style="width: ${energy}%"></div>
                        </div>
                        <div class="story-vibe-percentage">${energy}%</div>
                    </div>
                    <div class="story-vibe-bar">
                        <div class="story-vibe-label">Happiness</div>
                        <div class="story-vibe-track">
                            <div class="story-vibe-fill valence" style="width: ${valence}%"></div>
                        </div>
                        <div class="story-vibe-percentage">${valence}%</div>
                    </div>
                    <div class="story-vibe-bar">
                        <div class="story-vibe-label">Danceability</div>
                        <div class="story-vibe-track">
                            <div class="story-vibe-fill danceability" style="width: ${danceability}%"></div>
                        </div>
                        <div class="story-vibe-percentage">${danceability}%</div>
                    </div>
                    <div class="story-vibe-bar">
                        <div class="story-vibe-label">Acousticness</div>
                        <div class="story-vibe-track">
                            <div class="story-vibe-fill acousticness" style="width: ${acousticness}%"></div>
                        </div>
                        <div class="story-vibe-percentage">${acousticness}%</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateMusicTimeSpanSlideContent() {
    // Try to find oldest and newest tracks from the data
    let oldestTrack = null;
    let newestTrack = null;
    let oldestYear = null;
    let newestYear = null;
    
    // Check contributors data for track release dates
    if (storyData.contributors && storyData.contributors.contributors) {
        storyData.contributors.contributors.forEach(contributor => {
            if (contributor.tracks) {
                contributor.tracks.forEach(track => {
                    if (track.releaseDate) {
                        const year = new Date(track.releaseDate).getFullYear();
                        if (!oldestYear || year < oldestYear) {
                            oldestYear = year;
                            oldestTrack = track;
                        }
                        if (!newestYear || year > newestYear) {
                            newestYear = year;
                            newestTrack = track;
                        }
                    }
                });
            }
        });
    }
    
    // If we have both oldest and newest tracks
    if (oldestTrack && newestTrack && oldestYear && newestYear) {
        const yearSpan = newestYear - oldestYear;
        let eraDescription = '';
        
        if (yearSpan >= 30) {
            eraDescription = 'spanning generations of music';
        } else if (yearSpan >= 20) {
            eraDescription = 'bridging decades of sound';
        } else if (yearSpan >= 10) {
            eraDescription = 'crossing musical eras';
        } else {
            eraDescription = 'capturing a moment in time';
        }
        
        return `
            <h1>📅 From ${oldestYear} to ${newestYear}</h1>
            <h2>A time machine in playlist form</h2>
            <p>Music ${eraDescription}</p>
            <div class="story-visual">
                <div class="story-time-span">
                    <div class="story-era-track">
                        <div class="story-era-year">${oldestYear}</div>
                        <div class="story-era-title">"${oldestTrack.name}"</div>
                        <div class="story-era-artist">${oldestTrack.artists}</div>
                        <div class="story-era-label">Oldest Track</div>
                    </div>
                    <div class="story-era-bridge">
                        <div class="story-era-span">${yearSpan} years</div>
                        <div class="story-era-line"></div>
                    </div>
                    <div class="story-era-track">
                        <div class="story-era-year">${newestYear}</div>
                        <div class="story-era-title">"${newestTrack.name}"</div>
                        <div class="story-era-artist">${newestTrack.artists}</div>
                        <div class="story-era-label">Newest Track</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Fallback to date range if available
    const dateRange = storyData.dateRange;
    if (dateRange && dateRange.earliest && dateRange.latest) {
        const startDate = new Date(dateRange.earliest);
        const endDate = new Date(dateRange.latest);
        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();
        const yearSpan = endYear - startYear;
        
        return `
            <h1>📅 Curated from ${startYear} to ${endYear}</h1>
            <h2>A musical timeline</h2>
            <div class="story-visual">
                <div class="story-timeline">
                    <div class="story-timeline-year">${startYear}</div>
                    <div class="story-timeline-arrow">→</div>
                    <div class="story-timeline-year">${endYear}</div>
                </div>
                <div class="story-timeline-info">
                    <p>Spanning <strong>${yearSpan > 0 ? yearSpan : 1} year${yearSpan !== 1 ? 's' : ''}</strong> of musical curation</p>
                </div>
            </div>
        `;
    }
    
    // Final fallback
    return `
        <h1>📅 A timeless collection</h1>
        <h2>Where every era shines</h2>
        <div class="story-visual">
            <div class="story-timeline-info">
                <i class="fas fa-clock" style="font-size: 64px; color: var(--story-accent-primary); margin: 24px 0;"></i>
                <p>Music that transcends time itself</p>
            </div>
        </div>
    `;
}

function generateSummarySlideContent() {
    const totalTracks = storyData.playlist?.totalTracks || 0;
    const totalArtists = storyData.totalUniqueArtists || 0;
    const totalGenres = storyData.totalGenres || 0;
    const playlistName = storyData.playlist?.name || 'This Collection';
    
    // Get top stats for a more personalized summary
    const topArtist = storyData.topArtists?.[0];
    const topGenre = storyData.topGenres?.[0];
    const energy = storyData.audioFeatures?.energy ? Math.round(storyData.audioFeatures.energy * 100) : null;
    
    return `
        <h1>✨ The story of</h1>
        <h2 class="story-highlight">${playlistName}</h2>
        <p>A symphony woven from diversity and passion</p>
        <div class="story-visual">
            <div class="story-stats-grid">
                <div class="story-stat-card">
                    <div class="story-stat-number">${totalTracks}</div>
                    <div class="story-stat-label">Songs</div>
                </div>
                <div class="story-stat-card">
                    <div class="story-stat-number">${totalArtists}</div>
                    <div class="story-stat-label">Artists</div>
                </div>
                <div class="story-stat-card">
                    <div class="story-stat-number">${totalGenres}</div>
                    <div class="story-stat-label">Genres</div>
                </div>
                <div class="story-stat-card">
                    <div class="story-stat-number">∞</div>
                    <div class="story-stat-label">Memories</div>
                </div>
            </div>
            <div class="story-summary-highlights">
                ${topArtist ? `
                    <div class="story-highlight-item">
                        <i class="fas fa-crown"></i>
                        <span>${topArtist.name} leads with ${topArtist.count} tracks</span>
                    </div>
                ` : ''}
                ${topGenre ? `
                    <div class="story-highlight-item">
                        <i class="fas fa-music"></i>
                        <span>${topGenre.genre} sets the mood</span>
                    </div>
                ` : ''}
                ${energy ? `
                    <div class="story-highlight-item">
                        <i class="fas fa-bolt"></i>
                        <span>${energy}% energy flowing through every beat</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function generateOutroSlideContent() {
    const playlistName = storyData.playlist?.name || 'Your Playlist';
    
    return `
        <h1>🚀 Thanks for listening</h1>
        <h2 class="story-highlight">${playlistName}</h2>
        <p>Your musical journey continues...</p>
        <div class="story-visual">
            <div class="story-navigation" style="position: relative; bottom: auto; left: auto; transform: none; margin-top: 32px;">
                <button class="story-nav-btn" onclick="showStorySlide(0)">
                    <i class="fas fa-redo"></i>
                    <span>Replay</span>
                </button>
                <button class="story-nav-btn primary" onclick="exitStory()">
                    <i class="fas fa-arrow-left"></i>
                    <span>Back to Dashboard</span>
                </button>
            </div>
        </div>
        <p style="margin-top: 24px;">🎧 Keep discovering, keep vibing</p>
    `;
}

// Navigation and UI Functions
function initializeStoryUI() {
    // Initialize slide indicators
    const indicatorsContainer = document.getElementById('story-indicators');
    if (indicatorsContainer) {
        const indicators = Array.from({ length: TOTAL_STORY_SLIDES }, (_, i) => 
            `<div class="story-dot ${i === 0 ? 'active' : ''}" data-slide="${i}"></div>`
        );
        indicatorsContainer.innerHTML = indicators.join('');
    }
    
    // Update counter
    updateStoryCounter();
    
    // Update progress bar
    updateStoryProgress();
}

function setupStoryNavigation() {
    const prevBtn = document.getElementById('story-prev-btn');
    const nextBtn = document.getElementById('story-next-btn');
    const exitBtn = document.getElementById('story-exit-btn');
    
    // Button navigation - use stable event delegation
    if (prevBtn) {
        prevBtn.removeEventListener('click', handlePrevClick);
        prevBtn.addEventListener('click', handlePrevClick);
    }
    if (nextBtn) {n
        nextBtn.removeEventListener('click', handleNextClick);
        nextBtn.addEventListener('click', handleNextClick);
    }
    if (exitBtn) {
        exitBtn.removeEventListener('click', exitStory);
        exitBtn.addEventListener('click', exitStory);
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', handleStoryKeyboard);
    
    // Swipe functionality removed to enable better scrolling experience
}

function handlePrevClick() {
    navigateStory('prev');
}

function handleNextClick() {
    // Check if we're on the last slide
    if (storyCurrentSlide === TOTAL_STORY_SLIDES - 1) {
        exitStory();
    } else {
        navigateStory('next');
    }
}

function navigateStory(direction) {
    console.log(`🧭 Navigate: ${direction}, Current: ${storyCurrentSlide}, Total: ${TOTAL_STORY_SLIDES}`);
    
    if (direction === 'next' && storyCurrentSlide < TOTAL_STORY_SLIDES - 1) {
        const nextSlide = storyCurrentSlide + 1;
        console.log(`➡️ Moving from ${storyCurrentSlide} to ${nextSlide}`);
        showStorySlide(nextSlide);
    } else if (direction === 'prev' && storyCurrentSlide > 0) {
        const prevSlide = storyCurrentSlide - 1;
        console.log(`⬅️ Moving from ${storyCurrentSlide} to ${prevSlide}`);
        showStorySlide(prevSlide);
    } else {
        console.log(`🚫 Navigation blocked: ${direction} not allowed from slide ${storyCurrentSlide}`);
    }
}

function showStorySlide(slideIndex) {
    if (slideIndex < 0 || slideIndex >= TOTAL_STORY_SLIDES) {
        console.log(`🚫 Invalid slide index: ${slideIndex}`);
        return;
    }
    
    console.log(`📺 Showing slide ${slideIndex} (was ${storyCurrentSlide})`);
    storyCurrentSlide = slideIndex;
    
    // Update slides container with simple calculation
    const slidesContainer = document.getElementById('story-slides');
    if (slidesContainer) {
        // Each slide is 100vw, so move by -100vw * slideIndex
        const translateX = -slideIndex * 100;
        console.log(`🔄 Setting transform: translateX(${translateX}vw)`);
        slidesContainer.style.transform = `translateX(${translateX}vw)`;
    }
    
    // Update indicators
    updateStoryIndicators();
    
    // Update counter
    updateStoryCounter();
    
    // Update progress bar
    updateStoryProgress();
    
    // Update navigation buttons
    updateStoryNavigation();
    
    // Trigger slide animations
    triggerSlideAnimations(slideIndex);
}

function updateStoryIndicators() {
    const dots = document.querySelectorAll('.story-dot');
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === storyCurrentSlide);
    });
}

function updateStoryCounter() {
    const counter = document.getElementById('story-counter');
    if (counter) {
        counter.textContent = `${storyCurrentSlide + 1} / ${TOTAL_STORY_SLIDES}`;
    }
}

function updateStoryProgress() {
    const progressBar = document.getElementById('story-progress-bar');
    if (progressBar) {
        const progress = ((storyCurrentSlide + 1) / TOTAL_STORY_SLIDES) * 100;
        progressBar.style.width = `${progress}%`;
    }
}

function updateStoryNavigation() {
    const prevBtn = document.getElementById('story-prev-btn');
    const nextBtn = document.getElementById('story-next-btn');
    
    if (prevBtn) {
        prevBtn.disabled = storyCurrentSlide === 0;
        prevBtn.style.opacity = storyCurrentSlide === 0 ? '0.5' : '1';
    }
    
    if (nextBtn) {
        if (storyCurrentSlide === TOTAL_STORY_SLIDES - 1) {
            nextBtn.innerHTML = '<span>Finish</span><i class="fas fa-check"></i>';
        } else {
            nextBtn.innerHTML = '<span>Next</span><i class="fas fa-chevron-right"></i>';
        }
        // Don't rebind onclick - the event listener handles this
    }
}

function triggerSlideAnimations(slideIndex) {
    // Animate progress bars for vibe check slide
    if (slideIndex === 8) { // vibe-check slide
        setTimeout(() => {
            const vibeFills = document.querySelectorAll('.story-vibe-fill');
            vibeFills.forEach(fill => {
                const width = fill.style.width;
                fill.style.width = '0%';
                requestAnimationFrame(() => {
                    fill.style.width = width;
                });
            });
        }, 500);
    }
    
    // Render genre doughnut chart for genre diversity slide
    if (slideIndex === 1) { // genre-diversity slide
        setTimeout(() => {
            renderStoryGenreChart();
        }, 800);
    }
    
    // Animate popularity bars
    const popularityFills = document.querySelectorAll('.story-popularity-fill');
    popularityFills.forEach(fill => {
        const width = fill.style.width;
        fill.style.width = '0%';
        setTimeout(() => {
            fill.style.width = width;
        }, 800);
    });
}

function renderStoryGenreChart() {
    const canvas = document.getElementById('genre-doughnut');
    if (!canvas || !storyData.topGenres) return;
    
    // Clear any existing chart
    if (window.storyGenreChart) {
        window.storyGenreChart.destroy();
    }
    
    // Create a canvas element if the container is a div
    let chartCanvas = canvas;
    if (canvas.tagName === 'DIV') {
        chartCanvas = document.createElement('canvas');
        chartCanvas.width = 280;
        chartCanvas.height = 280;
        canvas.innerHTML = '';
        canvas.appendChild(chartCanvas);
    }
    
    const ctx = chartCanvas.getContext('2d');
    const genres = storyData.topGenres.slice(0, 5);
    const colors = ['#1db954', '#ff6b6b', '#4ecdc4', '#f093fb', '#667eea'];
    
    window.storyGenreChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: genres.map(g => g.genre),
            datasets: [{
                data: genres.map(g => g.count),
                backgroundColor: colors,
                borderWidth: 0,
                hoverBorderWidth: 4,
                hoverBorderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '60%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1db954',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${percentage}%`;
                        }
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeOutQuart'
            }
        }
    });
}

// Event Handlers
function handleStoryKeyboard(event) {
    if (!document.getElementById('story-container').classList.contains('hidden')) {
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                navigateStory('prev');
                break;
            case 'ArrowRight':
                event.preventDefault();
                navigateStory('next');
                break;
            case 'Escape':
                event.preventDefault();
                exitStory();
                break;
        }
    }
}

// Remove touch event handlers since swipe is disabled
// function handleTouchStart(event) { ... }
// function handleTouchMove(event) { ... }
// function handleTouchEnd(event) { ... }

// Helper Functions
function getGenreTitle(genre) {
    const titles = {
        'afrobeats': 'Afrobeats Maestro',
        'amapiano': 'Amapiano Oracle',
        'hip hop': 'Hip Hop Head',
        'pop': 'Pop Pioneer',
        'rock': 'Rock Legend',
        'jazz': 'Jazz Connoisseur',
        'electronic': 'Electronic Explorer',
        'classical': 'Classical Curator',
        'country': 'Country Champion',
        'reggae': 'Reggae Ruler'
    };
    
    return titles[genre.toLowerCase()] || `${genre} Expert`;
}

function generateConfetti() {
    const colors = ['#1db954', '#ff6b6b', '#4ecdc4', '#f093fb', '#667eea'];
    const pieces = Array.from({ length: 50 }, (_, i) => {
        const color = colors[i % colors.length];
        const left = Math.random() * 100;
        const delay = Math.random() * 3;
        
        return `<div class="story-confetti-piece" style="left: ${left}%; background: ${color}; animation-delay: ${delay}s;"></div>`;
    });
    
    return `<div class="story-confetti">${pieces.join('')}</div>`;
}

// Load cached data from public endpoint
async function loadCachedData() {
    try {
        console.log('Attempting to load cached data...');
        const response = await fetch('/api/public/data');
        
        if (response.ok) {
            const result = await response.json();
            currentData = result.data;
            console.log('✅ Cached data loaded successfully:', currentData.playlist.name);
            
            // Don't auto-show dashboard - let user click "Dive In"
            // Just store the data and keep showing landing page
            console.log(`Data available - user can now click "Dive In"`);
            
            // Update last updated info
            const lastUpdated = new Date(result.lastUpdated).toLocaleString();
            console.log(`Data last updated: ${lastUpdated}`);
            
        } else {
            console.log('No cached data available - showing landing page');
            currentData = null;
        }
        
        // Always show landing page first
        showLandingPage();
        
    } catch (error) {
        console.error('Error loading cached data:', error);
        currentData = null;
        showLandingPage();
    }
}

// Load theme on page load
loadTheme();

// Advanced Analytics Functions
async function loadAdvancedAnalytics() {
    if (!currentData) {
        console.log('No playlist data available for advanced analytics');
        return;
    }
    
    const playlistId = '1BZY7mhShLhc2fIlI6uIa4';
    
    try {
        console.log('🔍 Loading advanced analytics...');
        
        // Show loading indicators
        showAdvancedAnalyticsLoading();
        
        // Load all advanced analytics in parallel
        const [contributorsData, languagesData, geographyData] = await Promise.all([
            loadContributorAnalytics(playlistId),
            loadLanguageAnalytics(playlistId),
            loadGeographicAnalytics(playlistId)
        ]);
        
        // Store in global state
        currentData.advancedAnalytics = {
            contributors: contributorsData,
            languages: languagesData,
            geography: geographyData
        };
        
        // Update dashboard with advanced features
        populateAdvancedAnalytics(currentData.advancedAnalytics);
        
        console.log('✅ Advanced analytics loaded successfully');
        
    } catch (error) {
        console.error('Error loading advanced analytics:', error);
        showNotification('Could not load advanced analytics', 'error');
    }
}

function showAdvancedAnalyticsLoading() {
    // Show loading indicators in each section
    const sections = [
        'contributor-analytics',
        'language-summary', 
        'geographic-summary'
    ];
    
    sections.forEach(sectionId => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Loading analytics...</div>';
        }
    });
}

async function loadContributorAnalytics(playlistId) {
    const response = await fetch('/api/public/data');
    if (response.ok) {
        const result = await response.json();
        return generateClientSideContributorAnalytics(result.data);
    }
    throw new Error('Failed to load contributor analytics');
}

async function loadLanguageAnalytics(playlistId) {
    const response = await fetch('/api/public/data');
    if (response.ok) {
        const result = await response.json();
        return generateClientSideLanguageAnalytics(result.data);
    }
    throw new Error('Failed to load language analytics');
}

async function loadGeographicAnalytics(playlistId) {
    const response = await fetch('/api/public/data');
    if (response.ok) {
        const result = await response.json();
        return generateClientSideGeographicAnalytics(result.data);
    }
    throw new Error('Failed to load geographic analytics');
}

// Client-side analytics generation (using cached data)
function generateClientSideContributorAnalytics(data) {
    const contributors = data.topContributors || [];
    
    // Enhanced contributor data with badges
    const enhancedContributors = contributors.map((contributor, index) => {
        const badges = [];
        
        // Assign badges based on contribution patterns
        if (index === 0 && contributor.count >= 10) {
            badges.push({
                id: 'top_curator',
                name: '🔥 Top Curator',
                description: 'Added the most songs to this playlist'
            });
        }
        
        if (contributor.count >= 20) {
            badges.push({
                id: 'prolific',
                name: '🎵 Prolific Contributor',
                description: 'Added many songs to this playlist'
            });
        }
        
        if (contributor.count >= 5 && contributor.count <= 15) {
            badges.push({
                id: 'underground_hero',
                name: '🌚 Underground Hero',
                description: 'Added quality underground tracks'
            });
        }
        
        // Genre diversity badge (simplified)
        if (data.topGenres && data.topGenres.length >= 5) {
            badges.push({
                id: 'genre_guru',
                name: '🎖️ Genre Guru',
                description: 'Contributed to playlist diversity'
            });
        }
        
        return {
            ...contributor,
            badges,
            percentage: Math.round((contributor.count / data.playlist.totalTracks) * 100)
        };
    });
      return {
        totalContributors: contributors.length,
        contributors: enhancedContributors,
        summary: {
            mostActive: contributors[0]?.displayName || 'Unknown',
            avgContribution: Math.round(data.playlist.totalTracks / Math.max(contributors.length, 1)),
            totalGenres: data.topGenres?.length || 0
        }
    };
}

function generateClientSideLanguageAnalytics(data) {
    // Simple language detection based on artist names and genres
    const languages = {};
    
    // Analyze top genres for language patterns
    (data.topGenres || []).forEach(genre => {
        const lang = detectLanguageFromGenre(genre.genre);
        languages[lang] = (languages[lang] || 0) + genre.count;
    });
    
    // Analyze artist names
    (data.topArtists || []).forEach(artist => {
        const lang = detectLanguageFromName(artist.name);
        languages[lang] = (languages[lang] || 0) + 1;
    });
    
    const languageArray = Object.entries(languages)
        .map(([language, count]) => ({ language, count }))
        .sort((a, b) => b.count - a.count);
    
    return {
        totalSamples: Object.values(languages).reduce((sum, count) => sum + count, 0),
        languages: languageArray,
        summary: {
            primaryLanguage: languageArray[0]?.language || 'English',
            languageCount: languageArray.length,
            diversity: languageArray.length / Math.max(languageArray.length, 1)
        }
    };
}

function generateClientSideGeographicAnalytics(data) {
    const countries = {};
    
    // Analyze based on genres to determine countries
    (data.topGenres || []).forEach(genre => {
        const country = getCountryFromGenre(genre.genre);
        if (!countries[country]) {
            countries[country] = {
                country,
                count: 0,
                genres: [],
                artists: []
            };
        }
        countries[country].count += genre.count;
        countries[country].genres.push(genre.genre);
    });
    
    // Also analyze artist names for additional country clues
    (data.topArtists || []).forEach(artist => {
        const country = getCountryFromArtistName(artist.name);
        if (country && country !== 'Unknown') {
            if (!countries[country]) {
                countries[country] = {
                    country,
                    count: 0,
                    genres: [],
                    artists: []
                };
            }
            countries[country].count += artist.count;
            countries[country].artists.push(artist.name);
        }
    });
    
    const countryArray = Object.values(countries)
        .sort((a, b) => b.count - a.count);
    
    return {
        totalCountries: countryArray.length,
        countries: countryArray,
        summary: {
            topCountry: countryArray[0]?.country || 'Unknown',
            globalSpread: countryArray.length,
            totalTracks: data.playlist.totalTracks
        }
    };
}

function detectLanguageFromGenre(genre) {
    const lowerGenre = genre.toLowerCase();
    
    if (lowerGenre.includes('afro') || lowerGenre.includes('amapiano') || 
        lowerGenre.includes('gengetone') || lowerGenre.includes('gqom')) {
        return 'African Languages';
    }
    
    if (lowerGenre.includes('latin') || lowerGenre.includes('reggaeton') || 
        lowerGenre.includes('salsa') || lowerGenre.includes('bachata')) {
        return 'Spanish';
    }
    
    if (lowerGenre.includes('k-pop') || lowerGenre.includes('korean')) {
        return 'Korean';
    }
    
    return 'English';
}

function detectLanguageFromName(name) {
    // Simple pattern matching for artist names
    const lowerName = name.toLowerCase();
    
    // African name patterns
    if (/\b(wa|ma|ka|na|ndi|mtu|bem|wel|ose|eko|ike|chi|oba)\b/.test(lowerName)) {
        return 'African Languages';
    }
    
    // Spanish name patterns
    if (/\b(carlos|maria|jose|juan|ana|luis|pedro|carmen|antonio)\b/.test(lowerName)) {
        return 'Spanish';
    }
      return 'English';
}

function getCountryFromArtistName(artistName) {
    const lowerName = artistName.toLowerCase();
    
    // Kenyan artists (common names and known artists)
    if (['nyashinski', 'bien', 'sauti sol', 'khaligraph jones', 'king kaka', 'otile brown', 
         'akothee', 'victoria kimani', 'fena gitu', 'wahu', 'nameless', 'redsan',
         'octopizzo', 'mejja', 'jua cali', 'nonini', 'prezzo', 'lady s'].some(name => lowerName.includes(name))) {
        return 'Kenya';
    }
    
    // Nigerian artists (Afrobeats stars)
    if (['wizkid', 'davido', 'burna boy', 'tiwa savage', 'yemi alade', 'tekno', 'mr eazi',
         'adekunle gold', 'simi', 'falz', 'olamide', 'phyno', 'ice prince', 'wande coal',
         'banky w', 'flavour', 'patoranking', 'runtown', 'kizz daniel'].some(name => lowerName.includes(name))) {
        return 'Nigeria';
    }
    
    // South African artists
    if (['black coffee', 'nasty c', 'sjava', 'anatii', 'kwesta', 'cassper nyovest',
         'aka', 'lady zamar', 'shekhinah', 'trevor noah', 'masters kmd', 'sun-el musician',
         'focalistic', 'major league djz', 'kabza de small', 'dj maphorisa'].some(name => lowerName.includes(name))) {
        return 'South Africa';
    }
    
    // Ghanaian artists
    if (['sarkodie', 'shatta wale', 'stonebwoy', 'r2bees', 'efya', 'becca', 'kwesi arthur',
         'medikal', 'joey b', 'edem', 'manifest', 'wanlov'].some(name => lowerName.includes(name))) {
        return 'Ghana';
    }
    
    // American artists (Hip-hop, R&B, Pop)
    if (['eminem', 'kanye west', 'j. cole', 'drake', 'kendrick lamar', 'jay-z', 'beyoncé',
         'rihanna', 'travis scott', 'cardi b', 'megan thee stallion', 'doja cat', 'lil wayne',
         'nicki minaj', 'future', 'post malone', 'ariana grande', 'taylor swift'].some(name => lowerName.includes(name))) {
        return 'United States';
    }
    
    // UK artists
    if (['coldplay', 'ed sheeran', 'adele', 'sam smith', 'dua lipa', 'harry styles',
         'stormzy', 'skepta', 'dave', 'little mix', 'one direction'].some(name => lowerName.includes(name))) {
        return 'United Kingdom';
    }
    
    // Irish artists
    if (['hozier', 'u2', 'sinead o\'connor', 'the cranberries', 'van morrison'].some(name => lowerName.includes(name))) {
        return 'Ireland';
    }
    
    // Canadian artists
    if (['the weeknd', 'justin bieber', 'shawn mendes', 'avril lavigne', 'celine dion',
         'alanis morissette', 'nickelback', 'arcade fire'].some(name => lowerName.includes(name))) {
        return 'Canada';
    }
    
    return 'Unknown';
}

function getCountryFromGenre(genre) {
    const lowerGenre = genre.toLowerCase();
    
    // African countries - more specific mapping
    if (lowerGenre.includes('gengetone') || lowerGenre.includes('kapuka')) {
        return 'Kenya';
    }
    
    if (lowerGenre.includes('afrobeats') || lowerGenre.includes('yoruba') || 
        lowerGenre.includes('hausa') || lowerGenre.includes('igbo')) {
        return 'Nigeria';
    }
    
    if (lowerGenre.includes('amapiano') || lowerGenre.includes('gqom') || 
        lowerGenre.includes('kwaito') || lowerGenre.includes('maskandi')) {
        return 'South Africa';
    }
    
    if (lowerGenre.includes('highlife') || lowerGenre.includes('hiplife') || 
        lowerGenre.includes('azonto') || lowerGenre.includes('akan')) {
        return 'Ghana';
    }
    
    if (lowerGenre.includes('bongo') || lowerGenre.includes('taarab') || 
        lowerGenre.includes('singeli')) {
        return 'Tanzania';
    }
    
    if (lowerGenre.includes('coupé-décalé') || lowerGenre.includes('zouglou')) {
        return 'Ivory Coast';
    }
    
    if (lowerGenre.includes('mbalax') || lowerGenre.includes('wolof')) {
        return 'Senegal';
    }
    
    // If it's general African but can't be more specific
    if (lowerGenre.includes('afro') && !lowerGenre.includes('afro-cuban')) {
        return 'Kenya'; // Default to Kenya since playlist has many Kenyan artists
    }
    
    // Latin American countries
    if (lowerGenre.includes('reggaeton') || lowerGenre.includes('dembow')) {
        return 'Puerto Rico';
    }
    
    if (lowerGenre.includes('cumbia') || lowerGenre.includes('vallenato')) {
        return 'Colombia';
    }
    
    if (lowerGenre.includes('bachata') || lowerGenre.includes('merengue')) {
        return 'Dominican Republic';
    }
    
    if (lowerGenre.includes('mariachi') || lowerGenre.includes('ranchera')) {
        return 'Mexico';
    }
    
    if (lowerGenre.includes('samba') || lowerGenre.includes('bossa nova') || 
        lowerGenre.includes('funk carioca')) {
        return 'Brazil';
    }
    
    if (lowerGenre.includes('tango')) {
        return 'Argentina';
    }
    
    // Asian countries
    if (lowerGenre.includes('k-pop') || lowerGenre.includes('korean')) {
        return 'South Korea';
    }
    
    if (lowerGenre.includes('j-pop') || lowerGenre.includes('japanese')) {
        return 'Japan';
    }
    
    if (lowerGenre.includes('bollywood') || lowerGenre.includes('hindi') || 
        lowerGenre.includes('bhangra')) {
        return 'India';
    }
    
    // European countries
    if (lowerGenre.includes('uk') || lowerGenre.includes('british') || 
        lowerGenre.includes('grime') || lowerGenre.includes('dubstep')) {
        return 'United Kingdom';
    }
    
    if (lowerGenre.includes('french') || lowerGenre.includes('chanson')) {
        return 'France';
    }
    
    if (lowerGenre.includes('german') || lowerGenre.includes('krautrock')) {
        return 'Germany';
    }
    
    // North American countries
    if (lowerGenre.includes('hip hop') || lowerGenre.includes('rap') || 
        lowerGenre.includes('country') || lowerGenre.includes('blues') || 
        lowerGenre.includes('jazz') || lowerGenre.includes('r&b')) {
        return 'United States';
    }
    
    if (lowerGenre.includes('indie rock') || lowerGenre.includes('alternative')) {
        return 'Canada';
    }
    
    return 'Unknown';
}

// Populate genre maestros section
function populateGenreMaestros(genreMaestros) {
    const container = document.getElementById('genre-maestros');
    if (!container || !genreMaestros || genreMaestros.length === 0) {
        if (container) {
            container.innerHTML = '<p class="no-data">No genre maestros found</p>';
        }
        return;
    }

    console.log('🎵 Populating genre maestros:', genreMaestros.length);

    container.innerHTML = `
        <div class="genre-maestros-grid">
            ${genreMaestros.slice(0, 12).map(maestro => `
                <div class="genre-maestro-card">
                    <div class="maestro-header">
                        <div class="maestro-avatar">
                            ${maestro.avatar ? 
                                `<img src="${maestro.avatar}" alt="${maestro.contributorName}" />` : 
                                `<div class="avatar-placeholder">${maestro.contributorName.charAt(0).toUpperCase()}</div>`
                            }
                        </div>
                        <div class="maestro-info">
                            <h4 class="maestro-name">${maestro.contributorName}</h4>
                            <p class="maestro-title">${maestro.title}</p>
                        </div>
                    </div>
                    <div class="maestro-stats">
                        <div class="stat-row">
                            <span class="stat-label">Tracks</span>
                            <span class="stat-value">${maestro.songCount}/${maestro.totalGenreTracks}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Dominance</span>
                            <span class="stat-value">${maestro.percentage}%</span>
                        </div>
                    </div>
                    <div class="genre-badge">
                        <span class="genre-name">${maestro.genre}</span>
                    </div>
                    ${maestro.tracks && maestro.tracks.length > 0 ? `
                        <div class="maestro-tracks">
                            <p class="tracks-label">Top tracks:</p>
                            ${maestro.tracks.slice(0, 2).map(track => `
                                <div class="track-item">
                                    <span class="track-name">${track.name}</span>
                                    <span class="track-artist">${track.artists}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        
        <div class="maestros-summary">
            <div class="summary-text">
                <i class="fas fa-crown"></i>
                <span>Found ${genreMaestros.length} genre champions across the playlist</span>
            </div>
        </div>
    `;
}

// Populate playlist members section
function populatePlaylistMembers(membersData) {
    const container = document.getElementById('playlist-members');
    if (!container || !membersData) {
        if (container) {
            container.innerHTML = '<p class="no-data">No members data available</p>';
        }
        return;
    }

    console.log('👥 Populating playlist members:', membersData);

    const { contributors, listeners, summary } = membersData;

    container.innerHTML = `
        <div class="members-overview">
            <div class="members-stats">
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-info">
                        <span class="stat-number">${summary.totalMembers}</span>
                        <span class="stat-label">Total Members</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🎶</div>
                    <div class="stat-info">
                        <span class="stat-number">${summary.contributorCount}</span>
                        <span class="stat-label">Contributors</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🎧</div>
                    <div class="stat-info">
                        <span class="stat-number">${summary.listenerCount}</span>
                        <span class="stat-label">Listeners</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="members-sections">
            <div class="contributors-section">
                <div class="section-header">
                    <h4><i class="fas fa-plus-circle"></i> Contributors</h4>
                    <p>People who have added tracks to this playlist</p>
                </div>
                <div class="members-list">
                    ${contributors.map((member, index) => `
                        <div class="member-card contributor">
                            <div class="member-rank">#${index + 1}</div>
                            <div class="member-avatar">
                                ${member.avatar ? 
                                    `<img src="${member.avatar}" alt="${member.name}" />` : 
                                    `<div class="avatar-placeholder">${member.name.charAt(0).toUpperCase()}</div>`
                                }
                                <div class="member-role-badge">${member.icon}</div>
                            </div>
                            <div class="member-info">
                                <h5 class="member-name">${member.name}</h5>
                                <p class="member-role">${member.role}</p>
                                <p class="member-description">${member.description}</p>
                                ${member.followerCount ? `
                                    <p class="member-followers">${member.followerCount.toLocaleString()} followers</p>
                                ` : ''}
                            </div>
                            <div class="member-stats">
                                <div class="stat-item">
                                    <span class="stat-value">${member.tracksAdded}</span>
                                    <span class="stat-label">tracks</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            ${listeners.count > 0 ? `
                <div class="listeners-section">
                    <div class="section-header">
                        <h4><i class="fas fa-headphones"></i> Listeners</h4>
                        <p>People who follow this playlist</p>
                    </div>
                    <div class="listeners-info">
                        <div class="listeners-count">
                            <span class="count">${listeners.count}</span>
                            <span class="label">estimated listeners</span>
                        </div>
                        <div class="listeners-note">
                            <i class="fas fa-info-circle"></i>
                            <span>${listeners.note}</span>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Load and display members and genre champions
async function loadMembersAndChampions() {
    const playlistId = '1BZY7mhShLhc2fIlI6uIa4';
    
    try {
        console.log('🔍 Loading playlist members and genre champions...');
        
        const accessToken = getCookie('spotify_access_token');
        
        const response = await fetch('/api/playlist/members-and-champions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playlistId: playlistId,
                accessToken: accessToken
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to load members and champions');
        }
        
        const data = await response.json();
        
        // Populate the sections
        populateGenreMaestros(data.genreChampions);
        populatePlaylistMembers(data.members);
        
        console.log('✅ Members and champions loaded successfully');
        
        return data;
        
    } catch (error) {
        console.error('Error loading members and champions:', error);
        
        // Show error state
        const genreMaestrosContainer = document.getElementById('genre-maestros');
        const playlistMembersContainer = document.getElementById('playlist-members');
        
        if (genreMaestrosContainer) {
            genreMaestrosContainer.innerHTML = '<p class="error-message">Failed to load genre champions</p>';
        }
        if (playlistMembersContainer) {
            playlistMembersContainer.innerHTML = '<p class="error-message">Failed to load playlist members</p>';
        }
    }
}

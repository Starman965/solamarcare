async function handleRegister() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorElement = document.getElementById('authError');

    // Reset error message
    errorElement.textContent = '';

    // Validate inputs
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
        errorElement.textContent = 'Please fill in all fields';
        return;
    }

    if (password !== confirmPassword) {
        errorElement.textContent = 'Passwords do not match';
        return;
    }

    if (password.length < 6) {
        errorElement.textContent = 'Password must be at least 6 characters long';
        return;
    }

    try {
        // Create user with email and password
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Add user profile to Firestore
        await db.collection('users').doc(user.uid).set({
            firstName: firstName,
            lastName: lastName,
            email: email,
            role: 'admin', // Since this is your CRM, first user is admin
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update user profile with full name for display
        await user.updateProfile({
            displayName: `${firstName} ${lastName}`
        });

        // Redirect to app
        window.location.href = 'app.html';
    } catch (error) {
        console.error('Error during registration:', error);
        errorElement.textContent = error.message;
    }
}

// Handle Enter key
document.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        handleRegister();
    }
}); 
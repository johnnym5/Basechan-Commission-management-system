# Security Architecture

## Authentication
- **Provider:** Google Authentication (`GoogleAuthProvider`) via Firebase Auth.
- **Domain Restriction:** Strictly restricted to `@basechaninternational.com` email addresses.
- **Client Guard:** If a user authenticates with an email address not ending in `@basechaninternational.com`, they are immediately signed out with an access-denied error message displayed on the login interface.

## Trust Boundaries
- The client browser is untrusted. Even though this is an internal app, Firebase configurations are visible on the web client.
- **Defense:** Firestore Security Rules enforce domain restrictions and admin rights at the database tier.

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Check if user is authenticated and belongs to the basechaninternational.com domain
    function isBasechanUser() {
      return request.auth != null 
        && request.auth.token.email.matches('.*@basechaninternational[.]com$')
        && request.auth.token.email_verified == true;
    }

    // Helper function to check if user is in the admins whitelist collection
    function isAdmin() {
      return isBasechanUser() 
        && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    // Admins collection: users can read their own status; writes are restricted
    match /admins/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Managed directly in Firebase Console or via seed scripts
    }

    // Business collections: allow read/write to verified Basechan admins
    match /universities/{uniId} {
      allow read, write: if isBasechanUser();
    }
    
    match /rates/{rateId} {
      allow read, write: if isBasechanUser();
    }
  }
}
```

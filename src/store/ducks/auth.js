import firebase from '../../config/Firebase'
import { INITIAL_IMAGE } from '../../utils/Constants'

import { alertSuccessMessage, alertErrorMessage } from '../../utils/SweetAlert'

import { getEarningClass } from '../../service/Axios'

export const Types = {
  LOADING: 'auth/LOADING',
  LOGIN: 'auth/LOGIN',
  LOGOUT: 'auth/LOGOUT',
  USERINFO: 'auth/USERINFO',
  ERROR: 'auth/ERROR',
}

const INITIAL_STATE = {
  isLogged: false,
  isLoading: false,
  authUser: {},
  errorMessage: '',
}

export default function reducer(state = INITIAL_STATE, action) {
  switch (action.type) {
    case Types.LOADING:
      return {
        ...state,
        isLoading: action.payload,
      }
    case Types.LOGIN:
      return {
        ...state,
        isLogged: true,
        errorMessage: '',
      }
    case Types.USERINFO:
      return {
        ...state,
        authUser: action.payload,
        isLogged: true,
        errorMessage: '',
      }
    case Types.LOGOUT:
      return {
        ...state,
        isLogged: action.payload.isLogged,
        authUser: action.payload.authUser,
      }
    case Types.ERROR:
      return {
        ...state,
        errorMessage: action.payload,
      }
    default:
      return state
  }
}

export const Creators = {
  handleSignUp: (
    email,
    city,
    password,
    confirmPassword,
    firstName,
    userImageBase64,
  ) => {
    return async dispatch => {
      const db = firebase.firestore()

      //userImageBase64 Empty?
      if (userImageBase64 === '') {
        userImageBase64 = INITIAL_IMAGE
      }

      //Get UserPicture
      const storage = firebase.storage()
      const storageRef = storage.ref()
      const imgsRef = storageRef.child('images/users/')

      if (!email || !password || !confirmPassword || !firstName || !city) {
        dispatch({
          type: Types.ERROR,
          payload: 'Please, fill in all required fields.',
        })
      } else if (password !== confirmPassword) {
        dispatch({
          type: Types.ERROR,
          payload: 'Passwords need to be equal.',
        })
      } else {
        await firebase
          .auth()
          .createUserWithEmailAndPassword(email, password)
          .then(async user => {
            await db
              .collection('users')
              .doc('data')
              .collection('profile')
              .doc(user.user.uid)
              .set({
                name: firstName,
                city,
              })

            const userImageURL = await imgsRef
              .child(user.user.uid)
              .putString(userImageBase64, 'base64', {
                contentType: 'image/png',
              })
              .then(
                async () =>
                  await imgsRef
                    .child(user.user.uid)
                    .getDownloadURL()
                    .then(url => {
                      return url
                    }),
              )

            dispatch({
              type: Types.USERINFO,
              payload: {
                userName: firstName,
                userCity: city,
                userEmail: email,
                userImageURL,
              },
            })
          })
          .catch(error => {
            if (error.code === 'auth/invalid-email')
              dispatch({
                type: Types.ERROR,
                payload: 'Invalid email address format.',
              })

            if (error.code === 'auth/email-already-in-use')
              dispatch({
                type: Types.ERROR,
                payload: 'This email is already in use.',
              })

            if (error.code === 'auth/weak-password')
              dispatch({
                type: Types.ERROR,
                payload: 'You need to use a strong password.',
              })

            if (error.code === 'auth/operation-not-allowed')
              dispatch({
                type: Types.ERROR,
                payload: "Create user with email isn't allowed.",
              })
          })
      }
    }
  },

  handleLogin: (email, password) => {
    return async dispatch => {
      if (!email || !password) {
        dispatch({
          type: Types.ERROR,
          payload: 'Please, fill in all required fields.',
        })
      } else {
        await firebase
          .auth()
          .signInWithEmailAndPassword(email, password)
          .then(async () => {
            await dispatch(Creators.handleUserInfo())
          })
          .then(
            async () =>
              await dispatch({
                type: Types.LOGIN,
                payload: true,
              }),
          )
          .catch(error => {
            if (error.code === 'auth/invalid-email')
              dispatch({
                type: Types.ERROR,
                payload: 'Invalid email address format.',
              })

            if (error.code === 'auth/user-not-found')
              dispatch({
                type: Types.ERROR,
                payload: "This account doesn't exist.",
              })

            if (error.code === 'auth/wrong-password')
              dispatch({
                type: Types.ERROR,
                payload: 'Wrong password.',
              })

            if (error.code === 'auth/too-many-requests')
              dispatch({
                type: Types.ERROR,
                payload: 'You tried to login so many times, wait.',
              })
          })
      }
    }
  },

  handleForgotPassword: email => {
    return async dispatch => {
      if (!email) {
        dispatch({
          type: Types.ERROR,
          payload: 'Please, fill in all required fields.',
        })
      } else {
        await firebase
          .auth()
          .sendPasswordResetEmail(email)
          .catch(error => {
            if (error.code === 'auth/invalid-email')
              dispatch({
                type: Types.ERROR,
                payload: 'Invalid email address format.',
              })

            if (error.code === 'auth/user-not-found')
              dispatch({
                type: Types.ERROR,
                payload: "This account doesn't exist.",
              })
          })
      }
    }
  },

  handleUpdateProfile: (
    userName,
    monthAmount,
    userCity,
    userGenre,
    userEmail,
    userImageBase64,
  ) => {
    return async dispatch => {
      const db = firebase.firestore()

      const hasBase64 = userImageBase64 ? true : false

      if (!userName || !monthAmount || !userGenre || !userEmail || !userCity) {
        dispatch({
          type: Types.ERROR,
          payload: 'Please, fill in all required fields.',
        })

        alertErrorMessage('Please, fill in all required fields.')
        return false
      } else {
        await dispatch(Creators.handleLoader(true))
        const user = firebase.auth().currentUser
        if (user) {
          //Get UserPicture
          const storage = firebase.storage()
          const storageRef = storage.ref()
          const imgsRef = storageRef.child('images/users/')

          let userImageURL = ''

          if (hasBase64) {
            await imgsRef
              .child(user.uid)
              .putString(userImageBase64, 'base64', {
                contentType: 'image/png',
              })
              .then(
                async () =>
                  await imgsRef
                    .child(user.uid)
                    .getDownloadURL()
                    .then(url => {
                      userImageURL = url
                    }),
              )
          } else {
            await imgsRef
              .child(user.uid)
              .getDownloadURL()
              .then(url => {
                userImageURL = url
              })
          }

          const userEarnClass = await getEarningClass(monthAmount)

          await user
            .updateEmail(userEmail)
            .then(async () => {
              await db
                .collection('users')
                .doc('data')
                .collection('profile')
                .doc(user.uid)
                .set({
                  name: userName,
                  amount: monthAmount,
                  city: userCity,
                  gender: userGenre,
                  earningClass: userEarnClass,
                })

              dispatch({
                type: Types.USERINFO,
                payload: {
                  userName,
                  monthAmount,
                  userCity,
                  userGenre,
                  userEarnClass,
                  userEmail,
                  userUid: user.uid,
                  userImageURL,
                },
              })

              await dispatch(Creators.handleLoader(false))
              alertSuccessMessage('Your profile has been updated')
              return true
            })
            .catch(error => {
              if (error.code === 'auth/invalid-email')
                dispatch({
                  type: Types.ERROR,
                  payload: 'Invalid email address format.',
                })

              if (error.code === 'auth/email-already-in-use')
                dispatch({
                  type: Types.ERROR,
                  payload: 'This email is already in use.',
                })
            })
        }
      }
    }
  },

  handleUserInfo: () => {
    return async dispatch => {
      const user = firebase.auth().currentUser
      if (user) {
        //Get UserPicture
        const storage = firebase.storage()
        const storageRef = storage.ref()
        const imgsRef = storageRef.child('images/users/')
        const imgName = user.uid

        const userImageURL = await imgsRef
          .child(imgName)
          .getDownloadURL()
          .then(url => {
            return url
          })

        const db = firebase.firestore()
        const docRef = db
          .collection('users')
          .doc('data')
          .collection('profile')
          .doc(`${user.uid}`)
        docRef
          .get()
          .then(async doc => {
            if (doc.exists) {
              const userName = await doc.data().name
              const monthAmount = await doc.data().amount
              const userCity = await doc.data().city
              const gender = await doc.data().gender

              const userEarnClass = await getEarningClass(monthAmount)

              dispatch({
                type: Types.USERINFO,
                payload: {
                  userName,
                  monthAmount,
                  userEarnClass,
                  userCity,
                  userGenre: gender,
                  userEmail: user.email,
                  userUid: user.uid,
                  userImageURL,
                },
              })
            } else {
              console.log('No such document!')
            }
          })
          .catch(function(error) {
            console.log('Error getting document:', error)
          })
      } else {
        console.log('User not logged in')
      }
    }
  },

  handleLogout: () => {
    return async dispatch => {
      try {
        await firebase
          .auth()
          .signOut()
          .then(() =>
            dispatch({
              type: Types.LOGOUT,
              payload: {
                isLogged: false,
                authUser: {},
              },
            }),
          )
          .catch(error => {
            console.error(error)
          })
      } catch (err) {
        console.log(err)
      }
    }
  },

  handleLoader: status => {
    return async dispatch => {
      dispatch({
        type: Types.LOADING,
        payload: status,
      })
    }
  },
}

import { Platform, View, type ViewProps } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context'
import Constants from 'expo-constants'

// The content of a full-screen popup (a Modal with no presentationStyle, or "fullScreen"). The ordinary SafeAreaView
// can report a zero top inset inside a Modal that is shown again or opened right after another native screen (the
// camera, the document scanner), which put the header, and its close button, under the iPhone's clock and notch where
// it couldn't be tapped. A Modal is its own native window and gets its own SafeAreaProvider here, and the top is never
// smaller than the status bar's height on iOS, whatever the first measurement said.
function Inner({ edges, style, ...rest }: ViewProps & { edges: readonly Edge[] }) {
    const insets = useSafeAreaInsets()
    const top = edges.includes('top') ? Math.max(insets.top, Platform.OS === 'ios' ? Constants.statusBarHeight ?? 0 : 0) : 0
    const bottom = edges.includes('bottom') ? insets.bottom : 0
    return <View {...rest} style={[{ paddingTop: top, paddingBottom: bottom }, style]} />
}

export function ModalSafeArea({ edges = ['top', 'bottom'], ...rest }: ViewProps & { className?: string; edges?: readonly Edge[] }) {
    return (
        <SafeAreaProvider style={{ flex: 1 }}>
            <Inner edges={edges} {...rest} />
        </SafeAreaProvider>
    )
}

import { requireNativeView } from 'expo';
const NativeNamespaceProviderView = requireNativeView('ExpoUI', 'NamespaceProvider');
export function NamespaceProvider(props) {
    return <NativeNamespaceProviderView {...props}/>;
}
//# sourceMappingURL=NamespaceProvider.js.map
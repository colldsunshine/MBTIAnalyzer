import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
} from "@react-pdf/renderer";

import InterRegular from "./fonts/Inter-Regular.ttf";
import InterBold from "./fonts/Inter-Bold.ttf";

Font.register({
    family: "Inter",
    fonts: [
        {
            src: InterRegular,
            fontWeight: "normal",
        },
        {
            src: InterBold,
            fontWeight: "bold",
        },
    ],
});

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Helvetica',
        backgroundColor: '#ffffff',
    },
    type: {
        fontSize: 48,
        marginBottom: 20,
        textAlign: 'center',
        color: '#7E7845',
        fontFamily: 'Helvetica-Bold',
    },
    title: {
        fontSize: 24,
        marginBottom: 40,
        textAlign: 'center',
        color: '#252422',
    },
    scaleContainer: {
        marginVertical: 12,
        padding: 12,
        border: '1px solid #e0d5c5',
        borderRadius: 8,
        backgroundColor: '#fefef9',
    },
    scaleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    scaleLabel: {
        fontSize: 11,
        color: '#403d38',
    },
    scalePercent: {
        fontSize: 10,
        color: '#7f786e',
    },
    track: {
        height: 6,
        backgroundColor: '#e6dfd5',
        borderRadius: 3,
        overflow: 'hidden',
    },
    fill: {
        height: 6,
        backgroundColor: '#7E7845',
    },
    portrait: {
        marginTop: 40,
        fontSize: 11,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        color: '#252422',
    },
    sectionHeader: {
        fontSize: 16,
        marginTop: 20,
        marginBottom: 10,
        fontFamily: 'Helvetica-Bold',
        color: '#534E6E',
    },
});

const cleanMarkdown = (text) => {
    if (!text) return '';
    return text
        .replace(/^#+\s+/gm, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1');
};

export const PDFReport = ({ result, answers }) => {
    const scales = [
        { left: 'Introversion', right: 'Extraversion', value: result.percent.E },
        { left: 'Sensing', right: 'Intuition', value: result.percent.N },
        { left: 'Feeling', right: 'Thinking', value: result.percent.T },
        { left: 'Perceiving', right: 'Judging', value: result.percent.J },
    ];

    const portraitText = cleanMarkdown(result.portrait || '');

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.type}>{result.mbti_type}</Text>
                <Text style={styles.title}>Psychological Portrait</Text>

                {scales.map((scale, idx) => (
                    <View key={idx} style={styles.scaleContainer}>
                        <View style={styles.scaleRow}>
                            <Text style={styles.scaleLabel}>{scale.left}</Text>
                            <Text style={styles.scalePercent}>{scale.value}%</Text>
                            <Text style={styles.scaleLabel}>{scale.right}</Text>
                        </View>
                        <View style={styles.track}>
                            <View
                                style={[
                                    styles.fill,
                                    { width: `${scale.value}%`, backgroundColor: '#7E7845' },
                                ]}
                            />
                        </View>
                    </View>
                ))}

                <View style={styles.portrait}>
                    <Text>{portraitText}</Text>
                </View>

                {answers && answers.length > 0 && (
                    <>
                        <Text style={styles.sectionHeader}>Your answers</Text>
                        {answers.map((ans, i) => (
                            <Text key={i} style={{ fontSize: 9, marginBottom: 6, whiteSpace: 'pre-wrap' }}>
                                {ans}
                            </Text>
                        ))}
                    </>
                )}
            </Page>
        </Document>
    );
};

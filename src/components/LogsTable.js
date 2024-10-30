import React, { useState, useEffect } from 'react';
import { Button, Input, Typography, Table, Tag, Spin, Card, Collapse, Toast, Space, Tabs } from '@douyinfe/semi-ui';
import { IconSearch, IconCopy, IconDownload } from '@douyinfe/semi-icons';
import { API, timestamp2string, copy } from '../helpers';
import { stringToColor } from '../helpers/render';
import { ITEMS_PER_PAGE } from '../constants';
import { renderModelPrice, renderQuota } from '../helpers/render';
import Paragraph from '@douyinfe/semi-ui/lib/es/typography/paragraph';
import { Tooltip, Modal } from '@douyinfe/semi-ui';
import Papa from 'papaparse';

const { Text } = Typography;
const { Panel } = Collapse;
const { TabPane } = Tabs;

function renderTimestamp(timestamp) {
    return timestamp2string(timestamp);
}

function renderIsStream(bool) {
    if (bool) {
        return <Tag color="blue" size="large">Flow</Tag>;
    } else {
        return <Tag color="purple" size="large">Non-stream</Tag>;
    }
}

function renderUseTime(type) {
    const time = parseInt(type);
    if (time < 101) {
        return <Tag color="green" size="large"> {time} Second </Tag>;
    } else if (time < 300) {
        return <Tag color="orange" size="large"> {time} Second </Tag>;
    } else {
        return <Tag color="red" size="large"> {time} Second </Tag>;
    }
}

const LogsTable = () => {
    const [apikey, setAPIKey] = useState('');
    const [activeTabKey, setActiveTabKey] = useState('');
    const [tabData, setTabData] = useState({});
    const [loading, setLoading] = useState(false);
    const [activeKeys, setActiveKeys] = useState([]);
    const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
    const [baseUrl, setBaseUrl] = useState('');
    const baseUrls = JSON.parse(process.env.REACT_APP_BASE_URL);  // Parsing environment variables

    useEffect(() => {
        // By default, the first address is set to baseUrl
        const firstKey = Object.keys(baseUrls)[0];
        setActiveTabKey(firstKey);
        setBaseUrl(baseUrls[firstKey]);
    }, []);

    const handleTabChange = (key) => {
        setActiveTabKey(key);
        setBaseUrl(baseUrls[key]);
    };

    const resetData = (key) => {
        setTabData((prevData) => ({
            ...prevData,
            [key]: {
                balance: 0,
                usage: 0,
                accessdate: "Unknown",
                logs: [],
                tokenValid: false,
            }
        }));
    };

    const fetchData = async () => {
        if (apikey === '') {
            Toast.warning('Please enter the token before querying');
            return;
        }
        // 检查令牌格式
        if (!/^sk-[a-zA-Z0-9]{48}$/.test(apikey)) {
            Toast.error('Illegal token format!');
            return;
        }
        setLoading(true);
        let newTabData = { ...tabData[activeTabKey], balance: 0, usage: 0, accessdate: 0, logs: [], tokenValid: false };

        try {

            if (process.env.REACT_APP_SHOW_BALANCE === "true") {
                const subscription = await API.get(`${baseUrl}/v1/dashboard/billing/subscription`, {
                    headers: { Authorization: `Bearer ${apikey}` },
                });
                const subscriptionData = subscription.data;
                newTabData.balance = subscriptionData.hard_limit_usd;
                newTabData.tokenValid = true;

                let now = new Date();
                let start = new Date(now.getTime() - 100 * 24 * 3600 * 1000);
                let start_date = `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`;
                let end_date = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
                const res = await API.get(`${baseUrl}/v1/dashboard/billing/usage?start_date=${start_date}&end_date=${end_date}`, {
                    headers: { Authorization: `Bearer ${apikey}` },
                });
                const data = res.data;
                newTabData.usage = data.total_usage / 100;
            }
        } catch (e) {
            console.log(e)
            Toast.error("Token Exhausted");
            resetData(activeTabKey); // If an error occurs, reset all data to default values
            setLoading(false);
        }
        try {
            if (process.env.REACT_APP_SHOW_DETAIL === "true") {
                const logRes = await API.get(`${baseUrl}/api/log/token?key=${apikey}`);
                const { success, message, data: logData } = logRes.data;
                if (success) {
                    newTabData.logs = logData.reverse();
                    let quota = 0;
                    for (let i = 0; i < logData.length; i++) {
                        quota += logData[i].quota;
                    }
                    setActiveKeys(['1', '2']); // Automatically expand two accordions
                } else {
                    Toast.error('Failed to query call details, please enter the correct token');
                }
            }
        } catch (e) {
            Toast.error("Query failed, please enter a correct token");
            resetData(activeTabKey); // If an error occurs, reset all data to default values
            setLoading(false);
        }
        setTabData((prevData) => ({
            ...prevData,
            [activeTabKey]: newTabData,
        }));
        setLoading(false);

    };

    const copyText = async (text) => {
        if (await copy(text)) {
            Toast.success('Copied:' + text);
        } else {
            Modal.error({ title: 'Unable to copy to clipboard, please copy manually', content: text });
        }
    };

    const columns = [
        {
            title: 'Created At',
            dataIndex: 'created_at',
            render: renderTimestamp,
            sorter: (a, b) => a.created_at - b.created_at,
        },
        {
            title: 'Token Name',
            dataIndex: 'token_name',
            render: (text, record, index) => {
                return record.type === 0 || record.type === 2 ? (
                    <div>
                        <Tag
                            color="grey"
                            size="large"
                            onClick={() => {
                                copyText(text);
                            }}
                        >
                            {' '}
                            {text}{' '}
                        </Tag>
                    </div>
                ) : (
                    <></>
                );
            },
            sorter: (a, b) => ('' + a.token_name).localeCompare(b.token_name),
        },
        {
            title: 'Model',
            dataIndex: 'model_name',
            render: (text, record, index) => {
                return record.type === 0 || record.type === 2 ? (
                    <div>
                        <Tag
                            color={stringToColor(text)}
                            size="large"
                            onClick={() => {
                                copyText(text);
                            }}
                        >
                            {' '}
                            {text}{' '}
                        </Tag>
                    </div>
                ) : (
                    <></>
                );
            },
            sorter: (a, b) => ('' + a.model_name).localeCompare(b.model_name),
        },
        {
            title: 'Time',
            dataIndex: 'use_time',
            render: (text, record, index) => {
                return record.model_name.startsWith('mj_') ? null : (
                    <div>
                        <Space>
                            {renderUseTime(text)}
                            {renderIsStream(record.is_stream)}
                        </Space>
                    </div>
                );
            },
            sorter: (a, b) => a.use_time - b.use_time,
        },
        {
            title: 'Prompt Tokens',
            dataIndex: 'prompt_tokens',
            render: (text, record, index) => {
                return record.model_name.startsWith('mj_') ? null : (
                    record.type === 0 || record.type === 2 ? <div>{<span> {text} </span>}</div> : <></>
                );
            },
            sorter: (a, b) => a.prompt_tokens - b.prompt_tokens,
        },
        {
            title: 'Completion Tokens',
            dataIndex: 'completion_tokens',
            render: (text, record, index) => {
                return parseInt(text) > 0 && (record.type === 0 || record.type === 2) ? (
                    <div>{<span> {text} </span>}</div>
                ) : (
                    <></>
                );
            },
            sorter: (a, b) => a.completion_tokens - b.completion_tokens,
        },
        {
            title: 'Quota',
            dataIndex: 'quota',
            render: (text, record, index) => {
                return record.type === 0 || record.type === 2 ? <div>{renderQuota(text, 6)}</div> : <></>;
            },
            sorter: (a, b) => a.quota - b.quota,
        },
        {
            title: 'Content',
            dataIndex: 'content',
            render: (text, record, index) => {
                let other = null;
                try {
                    if (record.other === '') {
                        record.other = '{}';
                    }
                    other = JSON.parse(record.other);
                } catch (e) {
                    return (
                        <Tooltip content="This version does not support displaying calculation details">
                            <Paragraph
                                ellipsis={{
                                    rows: 2,
                                }}
                            >
                                {text}
                            </Paragraph>
                        </Tooltip>
                    );
                }
                if (other == null) {
                    return (
                        <Paragraph
                            ellipsis={{
                                rows: 2,
                                showTooltip: {
                                    type: 'popover',
                                },
                            }}
                        >
                            {text}
                        </Paragraph>
                    );
                }
                let content = renderModelPrice(
                    record.prompt_tokens,
                    record.completion_tokens,
                    other.model_ratio,
                    other.model_price,
                    other.completion_ratio,
                    other.group_ratio,
                );
                return (
                    <Tooltip content={content}>
                        <Paragraph
                            ellipsis={{
                                rows: 2,
                            }}
                        >
                            {text}
                        </Paragraph>
                    </Tooltip>
                );
            },
        }
    ];

    const copyTokenInfo = (e) => {
        e.stopPropagation();
        const activeTabData = tabData[activeTabKey] || {};
        const { balance, usage, accessdate } = activeTabData;
        const info = `Total Tokens: ${balance === 100000000 ? 'Unlimited' : `${balance.toFixed(3)}`}
Remaining Amount: ${balance === 100000000 ? 'No Restrictions' : `${(balance - usage).toFixed(3)}`}
Used Amount: ${balance === 100000000 ? 'No Calculation' : `${usage.toFixed(3)}`}
Valid Until: ${accessdate === 0 ? 'Never Expires' : renderTimestamp(accessdate)}`;
        copyText(info);
    };

    const exportCSV = (e) => {
        e.stopPropagation();
        const activeTabData = tabData[activeTabKey] || { logs: [] };
        const { logs } = activeTabData;
        const csvData = logs.map(log => ({
            'Created At': renderTimestamp(log.created_at),
            'Model': log.model_name,
            'Time': log.use_time,
            'Prompt Tokens': log.prompt_tokens,
            'Completion Tokens': log.completion_tokens,
            'Quota': log.quota,
            'Content': log.content,
        }));
        const csvString = '\ufeff' + Papa.unparse(csvData);  // Use the PapaParse library to convert data
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'data.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const activeTabData = tabData[activeTabKey] || { logs: [], balance: 0, usage: 0, accessdate: "Unknown", tokenValid: false };

    const renderContent = () => (
        <>
            <Card style={{ marginTop: 24 }}>
                <Input
                    showClear
                    value={apikey}
                    onChange={(value) => setAPIKey(value)}
                    placeholder="Please enter the token to be queried sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    prefix={<IconSearch />}
                    suffix={
                        <Button
                            type='primary'
                            theme="solid"
                            onClick={fetchData}
                            loading={loading}
                            disabled={apikey === ''}
                        >
                            Query
                        </Button>
                    }
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            fetchData();
                        }
                    }}
                />
            </Card>
            <Card style={{ marginTop: 24 }}>
                <Collapse activeKey={activeKeys} onChange={(keys) => setActiveKeys(keys)}>
                    {process.env.REACT_APP_SHOW_BALANCE === "true" && (
                        <Panel
                            header="Token Information"
                            itemKey="1"
                            extra={
                                <Button icon={<IconCopy />} theme='borderless' type='primary' onClick={(e) => copyTokenInfo(e)} disabled={!activeTabData.tokenValid}>
                                    Copy Token Information
                                </Button>
                            }
                        >
                            <Spin spinning={loading}>
                                <div style={{ marginBottom: 16 }}>
                                    <Text type="secondary">
                                        Total Tokens:{activeTabData.balance === 100000000 ? "Unlimited" : activeTabData.balance === "Unknown" || activeTabData.balance === undefined ? "Unknown" : `${activeTabData.balance.toFixed(3)}`}
                                    </Text>
                                    <br /><br />
                                    <Text type="secondary">
                                        Remaining Amount：{activeTabData.balance === 100000000 ? "No Restrictions" : activeTabData.balance === "Unknown" || activeTabData.usage === "Unknown" || activeTabData.balance === undefined || activeTabData.usage === undefined ? "Unknown" : `${(activeTabData.balance - activeTabData.usage).toFixed(3)}`}
                                    </Text>
                                    <br /><br />
                                    <Text type="secondary">
                                        Used Amount：{activeTabData.balance === 100000000 ? "No Calculation" : activeTabData.usage === "Unknown" || activeTabData.usage === undefined ? "Unknown" : `${activeTabData.usage.toFixed(3)}`}
                                    </Text>
                                    <br /><br />
                                    <Text type="secondary">
                                        Valid Until:{activeTabData.accessdate === 0 ? 'Never Expires' : activeTabData.accessdate === "Unknown" ? 'Unknown' : renderTimestamp(activeTabData.accessdate)}
                                    </Text>
                                </div>
                            </Spin>
                        </Panel>
                    )}
                    {process.env.REACT_APP_SHOW_DETAIL === "true" && (
                        <Panel
                            header="Call Details"
                            itemKey="2"
                            extra={
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Tag shape='circle' color='green' style={{ marginRight: 5 }}>Calculated exchange rate: $1 = 50 0000 tokens</Tag>
                                    <Button icon={<IconDownload />} theme='borderless' type='primary' onClick={(e) => exportCSV(e)} disabled={!activeTabData.tokenValid || activeTabData.logs.length === 0}>
                                        Export to CSV file
                                    </Button>
                                </div>
                            }
                        >
                            <Spin spinning={loading}>
                                <Table
                                    columns={columns}
                                    dataSource={activeTabData.logs}
                                    pagination={{
                                        pageSize: pageSize,
                                        hideOnSinglePage: true,
                                        showSizeChanger: true,
                                        pageSizeOpts: [10, 20, 50, 100],
                                        onPageSizeChange: (pageSize) => setPageSize(pageSize),
                                        showTotal: (total) => `共 ${total} 条`,
                                        showQuickJumper: true,
                                        total: activeTabData.logs.length,
                                        style: { marginTop: 12 },
                                    }}
                                />
                            </Spin>
                        </Panel>
                    )}
                </Collapse>
            </Card>
        </>
    );

    return (
        <>
            {Object.keys(baseUrls).length > 1 ? (
                <Tabs type="line" onChange={handleTabChange}>
                    {Object.entries(baseUrls).map(([key, url]) => (
                        <TabPane tab={key} itemKey={key} key={key}>
                            {renderContent()}
                        </TabPane>
                    ))}
                </Tabs>
            ) : (
                renderContent()
            )}
        </>
    );
};

export default LogsTable;

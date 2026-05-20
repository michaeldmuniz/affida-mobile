const PAYMENT_URLS: [string, string][] = [
    ['chase',           'https://www.chase.com/digital/pages/card-payments/card-payments'],
    ['bank of america', 'https://secure.bankofamerica.com/myaccounts/signIn/signIn.go'],
    ['capital one',     'https://myaccounts.capitalone.com/accountSummary'],
    ['citi',            'https://online.citibank.com/US/JPS/pands/Payments.do'],
    ['discover',        'https://portal.discover.com/customersvcs/universalLogin/ac_main'],
    ['american express','https://www.americanexpress.com/en-us/payments/'],
    ['amex',            'https://www.americanexpress.com/en-us/payments/'],
    ['wells fargo',     'https://connect.secure.wellsfargo.com/auth/login/present'],
    ['us bank',         'https://onlinebanking.usbank.com/'],
    ['u.s. bank',       'https://onlinebanking.usbank.com/'],
    ['barclays',        'https://www.barclaysus.com/all-products/credit-cards/make-payment.html'],
    ['synchrony',       'https://www.mysynchrony.com/'],
    ['td bank',         'https://onlinebanking.tdbank.com/'],
    ['pnc',             'https://www.pnc.com/en/personal-banking/banking/online-and-mobile-banking.html'],
    ['navy federal',    'https://www.navyfederal.org/'],
    ['usaa',            'https://www.usaa.com/'],
    ['apple card',      'https://wallet.apple.com/'],
    ['goldman sachs',   'https://www.marcus.com/'],
    ['citizens',        'https://www.citizensbank.com/'],
    ['truist',          'https://www.truist.com/'],
    ['regions',         'https://www.regions.com/'],
    ['fifth third',     'https://www.53.com/'],
    ['key bank',        'https://www.key.com/'],
    ['ally',            'https://www.ally.com/'],
    ['sofi',            'https://www.sofi.com/'],
    ['paypal',          'https://www.paypal.com/myaccount/summary'],
    ['venmo',           'https://account.venmo.com/'],
]

export function getPaymentUrl(institutionName: string): string | null {
    const normalized = institutionName.toLowerCase()
    for (const [key, url] of PAYMENT_URLS) {
        if (normalized.includes(key)) return url
    }
    return null
}

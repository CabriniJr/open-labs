/**
 * O que as pessoas costumam acreditar, e o que a documentação diz. Cada linha é
 * um erro que a simulação foi feita para desmontar.
 */
export interface MalEntendidoDeRede {
  readonly crenca: string;
  readonly spec: string;
  readonly fonte: string;
}

export const MAL_ENTENDIDOS_DA_REDE: readonly MalEntendidoDeRede[] = [
  {
    crenca: "A VLAN is just a label; a switch port on VLAN 20 can still talk to VLAN 10.",
    spec: "Each VLAN is its own broadcast domain. Frames only cross between VLANs through a router (or a layer-3 switch); on a trunk, the 802.1Q tag says which VLAN each frame belongs to.",
    fonte: "https://www.cisco.com/c/en/us/support/docs/lan-switching/8021q/17056-741-4.html",
  },
  {
    crenca: "A new laptop already knows its IP address when it joins the Wi-Fi.",
    spec: "A DHCP client starts with no address and broadcasts a DHCPDISCOVER; the server offers, the client requests, the server acknowledges (RFC 2131, section 3.1).",
    fonte: "https://www.rfc-editor.org/rfc/rfc2131#section-3.1",
  },
  {
    crenca: "Private addresses like 192.168.x.x can be used on the internet if the router just forwards them.",
    spec: "192.168.0.0/16 is reserved for private networks and is not routed on the public internet (RFC 1918); a NAT device rewrites the source address on the way out.",
    fonte: "https://www.rfc-editor.org/rfc/rfc1918#section-3",
  },
  {
    crenca: "An access list checks every line and picks the best match.",
    spec: "An ACL is read from the top; the first line that matches decides, and a packet that matches no line is denied by the implicit deny at the end.",
    fonte: "https://www.cisco.com/c/en/us/support/docs/security/ios-firewall/23602-confaccesslists.html",
  },
  {
    crenca: "Blocking the Wi-Fi from the staff network still lets the staff reach the Wi-Fi.",
    spec: "The reply from the Wi-Fi has to cross the same inbound ACL; if it is denied there, the conversation fails in both directions. That is the point of the isolation — and why the test in the PDF works from either side.",
    fonte: "https://www.cisco.com/c/en/us/support/docs/security/ios-firewall/23602-confaccesslists.html",
  },
];
